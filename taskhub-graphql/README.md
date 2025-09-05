# TaskHub GraphQL

API GraphQL con **GraphQL Yoga + MongoDB (Mongoose)** y **Subscription** `taskCreated`.
Incluye Docker Compose (Mongo + API).

## Arranque rápido (local)

```bash
cp .env.example .env
npm i
npm run dev
# http://localhost:4001/graphql
```

## Con Docker

```bash
docker compose up -d --build
# http://localhost:4001/graphql
```

### Ejemplos (GraphiQL)

Crear usuario:
```graphql
mutation ($input: CreateUserInput!) {
  createUser(input: $input) { id name email }
}
```
Variables:
```json
{ "input": { "name": "Ana", "email": "ana@example.com" } }
```

Suscripción:
```graphql
subscription { taskCreated { id title done user { id name } } }
```

Crear tarea:
```graphql
mutation ($input: CreateTaskInput!) {
  createTask(input: $input) { id title done user { name } }
}
```
Variables:
```json
{ "input": { "title": "Bienvenida", "userId": "PEGAR_ID_USUARIO" } }
```
