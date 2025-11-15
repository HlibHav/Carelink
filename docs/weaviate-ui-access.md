# Як отримати доступ до Weaviate UI

## ✅ Weaviate Console (Офіційний веб UI)

**Weaviate Console** - це офіційний веб-додаток для підключення до будь-яких Weaviate інстансів, включаючи локальні!

### Доступ до Weaviate Console:

1. **Відкрийте в браузері:**
   ```
   https://console.semi.technology
   ```

2. **Підключіться до вашого локального Weaviate:**
   - URL: `http://localhost:8082`
   - (Або `http://localhost:8082/v1` якщо потрібно)

3. **Почніть робити запити!**

⚠️ **Примітка:** Для локального Weaviate потрібно щоб консоль могла доступитися до `localhost:8082`. Якщо це не працює через CORS або мережеві обмеження, використовуйте альтернативи нижче.

## ✅ Доступні опції для локального Weaviate:

### 1. GraphQL Playground (Рекомендовано)

**Варіант A: Використайте GraphiQL або Altair GraphQL Client**

#### Встановлення Altair GraphQL (найпростіше):

```bash
# macOS
brew install --cask altair-graphql-client

# Або завантажте з:
# https://altairgraphql.dev/
```

**Налаштування:**
1. Відкрийте Altair GraphQL
2. URL: `http://localhost:8082/v1/graphql`
3. Метод: POST
4. Починайте робити запити!

#### Приклад запиту в Altair:

```graphql
{
  Get {
    Memory(limit: 10) {
      userId
      category
      text
      importance
      createdAt
      _additional {
        id
        distance
      }
    }
  }
}
```

### 2. Postman / Insomnia

**Налаштування:**
- Base URL: `http://localhost:8082/v1`
- Endpoint: `/graphql` (POST)
- Headers: `Content-Type: application/json`

**Приклад запиту:**
```json
{
  "query": "{ Get { Memory(limit: 5) { text category } } }"
}
```

### 3. Браузер + curl (Швидкий доступ)

Відкрийте термінал та використовуйте curl:

```bash
# Отримати схему
curl http://localhost:8082/v1/schema | python3 -m json.tool

# GraphQL запит
curl -X POST http://localhost:8082/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Get { Memory(limit: 5) { text category } } }"}'
```

### 4. Memory Manager API (Найкраще для CareLink)

Використовуйте Memory Manager API, який інтегрує Weaviate:

```bash
# Пошук пам'яті
curl -X POST http://localhost:4103/memory/test-user/retrieve-for-dialogue \
  -H "Content-Type: application/json" \
  -d '{"query": "books"}'
```

## 🚀 Швидкий старт з Altair GraphQL:

1. **Встановіть Altair:**
   ```bash
   brew install --cask altair-graphql-client
   ```

2. **Відкрийте Altair та налаштуйте:**
   - URL: `http://localhost:8082/v1/graphql`
   - Method: POST

3. **Спробуйте запит:**
   ```graphql
   {
     Get {
       Memory(limit: 5) {
         text
         category
         importance
         createdAt
       }
     }
   }
   ```

## 📊 Корисні GraphQL запити:

### Отримати всі пам'яті користувача:
```graphql
{
  Get {
    Memory(
      where: {
        path: ["userId"]
        operator: Equal
        valueString: "test-user-123"
      }
      limit: 20
    ) {
      text
      category
      importance
      factType
      goalStatus
      createdAt
    }
  }
}
```

### Семантичний пошук:
```graphql
{
  Get {
    Memory(
      nearText: {
        concepts: ["books and reading"]
      }
      limit: 10
      where: {
        path: ["userId"]
        operator: Equal
        valueString: "test-user-123"
      }
    ) {
      text
      category
      _additional {
        id
        distance
      }
    }
  }
}
```

### Отримати схему:
```graphql
{
  __type(name: "Memory") {
    name
    fields {
      name
      type {
        name
      }
    }
  }
}
```

## 🔍 Перевірка доступності:

```bash
# Перевірити що Weaviate працює
curl http://localhost:8082/v1/.well-known/ready

# Перевірити метадані
curl http://localhost:8082/v1/meta

# Перевірити схему
curl http://localhost:8082/v1/schema
```

## 💡 Альтернатива: Weaviate Studio (Community Tool)

Існує community проект Weaviate Studio, але він потребує додаткового налаштування.

**Рекомендація:** Використовуйте **Altair GraphQL Client** - це найпростіший спосіб для локального Weaviate.

## 📝 Приклад роботи з Memory Manager (Найпростіше):

Для CareLink найпростіше використовувати Memory Manager API:

```bash
# Health check
curl http://localhost:4103/healthz

# Зберегти пам'ять
curl -X POST http://localhost:4103/memory/test-user/store-candidate \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "category": "facts",
      "text": "I love reading books",
      "importance": "high"
    }]
  }'

# Пошук
curl -X POST http://localhost:4103/memory/test-user/retrieve-for-dialogue \
  -H "Content-Type: application/json" \
  -d '{"query": "books"}'
```

