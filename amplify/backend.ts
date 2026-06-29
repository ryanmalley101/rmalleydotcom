import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { suggestPhotoTagsFunction } from './functions/suggest-photo-tags/resource.js';

const backend = defineBackend({
    auth,
    data,
    storage,
    suggestPhotoTagsFunction,
});

const suggestPhotoTagsLambda = backend.suggestPhotoTagsFunction.resources.lambda;
const stack = Stack.of(suggestPhotoTagsLambda);

backend.storage.resources.bucket.grantRead(suggestPhotoTagsLambda);
backend.suggestPhotoTagsFunction.addEnvironment('BUCKET_NAME', backend.storage.resources.bucket.bucketName);

suggestPhotoTagsLambda.addToRolePolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
            // Cross-region inference profile (required — this model has no on-demand inference type)
            `arn:aws:bedrock:${stack.region}:${stack.account}:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0`,
            // The underlying foundation model in every region the profile above routes to
            'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
        ],
    })
);

// Anthropic models on Bedrock are delivered via an AWS Marketplace
// subscription under the hood — the calling role needs these to complete
// that subscription handshake on first invocation, not just bedrock:InvokeModel.
suggestPhotoTagsLambda.addToRolePolicy(
    new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['aws-marketplace:ViewSubscriptions', 'aws-marketplace:Subscribe'],
        resources: ['*'],
    })
);

// Daily spend cap for AI tagging — one row per UTC day, costMicros
// accumulated atomically (1 input token = 1 micro-dollar, 1 output token =
// 5 micros, matching Claude Haiku 4.5's $1 / $5 per-million-token Bedrock
// pricing). The handler checks this before every Bedrock call and refuses
// once the daily budget is hit, so a bulk-tagging run can't run away.
const aiUsageTable = new Table(stack, 'AiUsageTable', {
    partitionKey: { name: 'date', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
});
aiUsageTable.grantReadWriteData(suggestPhotoTagsLambda);
backend.suggestPhotoTagsFunction.addEnvironment('AI_USAGE_TABLE_NAME', aiUsageTable.tableName);
backend.suggestPhotoTagsFunction.addEnvironment('DAILY_BUDGET_MICROS', '3000000'); // $3.00/day
