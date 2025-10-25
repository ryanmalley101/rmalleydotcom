"use client";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();
  
export default function App() {
  const { user, signOut } = useAuthenticator();

  // const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  // function listTodos() {
  //   client.models.Todo.observeQuery().subscribe({
  //     next: (data) => setTodos([...data.items]),
  //   });
  // }

  // useEffect(() => {
  //   listTodos();
  // }, []);

  // function createTodo() {
  //   client.models.Todo.create({
  //     content: window.prompt("Todo content"),
  //   });
  // }

    
  // function deleteTodo(id: string) {
  //   client.models.Todo.delete({ id })
  // }

  return (
    <main>
      <h1>{user?.signInDetails?.loginId}'s todos</h1>
      <button onClick={signOut}>Sign out</button>
    </main>
  );
}
