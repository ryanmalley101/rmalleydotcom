import {useEffect, useState} from "react";
import CreateMonsterStatblock from "@/app/components/creatorComponents/monsterCreator";
import ErrorBanner from '@/app/components/statusComponents/errorBanner';
import useConsoleError from '@/app/components/statusComponents/useConsoleError';
// import { Amplify } from "aws-amplify";
// import outputs from "@/amplify_outputs.json";
// import "@aws-amplify/ui-react/styles.css";

// Amplify.configure(outputs);
const MonsterCreator = () => {
    // const errorList = useConsoleError();

    return (
        <>
        
            {/* <ErrorBanner errors={errorList} /> */}
            <CreateMonsterStatblock/>
            {/* <button onClick={() => console.error('This is a test error')}>Log Error</button> */}
        </>
    );
};

export default MonsterCreator;