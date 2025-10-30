"use client";
import {useEffect, useState, ReactElement} from "react";


interface ConsoleErrorItem {
  id: number;
  message: string;
}

function useConsoleError() : ConsoleErrorItem[] {
  const [errors, setErrors] = useState<ConsoleErrorItem[]>([]);

  useEffect(() => {
    const originalConsoleError = console.error.bind(console);

    console.error = (...args: any[]) => {
      const id = Date.now();
      setErrors((prevErrors) => [...prevErrors, { id, message: args.join(' ') }]);
      originalConsoleError(...args);

      setTimeout(() => {
        setErrors((prevErrors) => prevErrors.filter(error => error.id !== id));
      }, 5000);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return errors;
}

export default useConsoleError