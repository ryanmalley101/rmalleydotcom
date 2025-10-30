import {useEffect, useState} from "react";
import CreateMonsterStatblock from "@components/creatorComponents/monsterCreator";
import ErrorBanner from '@components/statusComponents/errorBanner';
import useConsoleError from '@components/statusComponents/useConsoleError';

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