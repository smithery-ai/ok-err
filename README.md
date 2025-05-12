# `ok-err`

> **Typed, chain‑friendly, JSON‑safe Results for TypeScript**  

A small opinionated TypeScript library providing strongly-typed `Result` objects with chaining capabilities, inspired by Rust `std::result`.

## Why *ok-err*?

* **Plain object compatibility** - an `Ok` is `{ ok: true, value }`, an `Err` is `{ ok: false, error }`. Log it, persist it, send it over the wire.
* **Type‑level errors** - every possible failure is visible in the function signature (`Result<T, E>`), not thrown from the shadows. Rely on the type checker to ensure you handle every possible failure.
* **Cause‑chain built‑in** - wrap lower‑level errors with the `.annotate()` method; walk the `cause` links later to see the full logical call stack.
* **Iterable & ergonomic** - `for (const v of ok(3)) …` works, and helpers `map`, `flatMap`, `or` feel familiar to JS arrays.
* **Re‑hydration** - after `JSON.parse`, call `result(raw)` to get the fluent API back.

---

## Install

```bash
npm i ok-err
```

---

## Quick tour

### From try-catch to Result

Here's how `ok-err` changes error handling from exceptions to data:

```ts
// Traditional approach with try-catch
try {
  const user = getUserById(123);
  const greeting = formatGreeting(user.name);
  console.log(greeting);
} catch (error) {
  // Error source and type information can be ambiguous
  console.error('Something went wrong', error);
}

// Alternative approach with Result
import { ok, err, result } from 'ok-err';

// Define functions that return Result types
function getUserById(id: number) {
  try {
    if (id <= 0) {
      return err('InvalidId')({ id });
    }
    // Simulating database lookup
    const user = { id, name: 'Ada' };
    return ok(user);
  } catch (error) {
    // Convert any unexpected errors
    return err('DbError')({ cause: error });
  }
}

// Using the Result-returning function
const userResult = getUserById(123);
if (!userResult.ok) {
  // Typed error handling with precise context
  console.error(`Database error: ${userResult.error.type}`);
  return;
}

// Chain operations on successful results
const greeted = userResult
  .map(u => u.name.toUpperCase())         // Ok<string>
  .flatMap(name =>
    name.startsWith('A')
      ? ok(`Hello ${name}!`)              // Return Ok for success
      : err('NameTooShort')({ min: 1 })   // Return Err for failure
  )
  .or('Hi stranger!');                    // Use fallback if any step failed

console.log(greeted);                     // "Hello ADA!"
```

### Propagating context

Context propagation allows you to wrap lower-level errors with higher-level context as they move up through your application's layers so you know where the error occurred.

```ts
function readConfig(): Result<string, ConfigErr> { … }

function boot(): Result<void, BootErr> {
  const cfg = readConfig();
  if (!cfg.ok) {
    // Add higher-level context while preserving the original error
    return cfg.annotate('BootConfig', { phase: 'init' });
  }
  return ok(undefined);
}
```

#### How annotation works

`.annotate()` creates a new error that wraps the original error:

1. The original error becomes the `cause` property of the new error
2. Any additional payload properties are merged into the new error

This creates a discoverable, traceable error chain that's invaluable for debugging:

```plain
Err {
  type: "BootConfig",
  phase: "init",
  cause: Err {
    type: "ConfigFileMissing",
    path: "/etc/app.json",
    cause: Err { type: "IO", errno: "ENOENT" }
  }
}
```

### Working with async operations

`ok-err` can be used with async code to handle errors as data:

```ts
import { result } from 'ok-err';

// Wrap fetch with Result to handle both network and parsing errors
async function fetchUserData(userId: string) {
  // First, handle the network request
  const response = await result(fetch(`/api/users/${userId}`));
  if (!response.ok) {
    return response.annotate('NetworkError', { userId });
  }
  
  // Then handle the JSON parsing
  const data = await result(response.value.json());
  if (!data.ok) {
    return data.annotate('ParseError', { userId });
  }
  
  // Validate the data
  if (!data.value.name) {
    return err('ValidationError')({ 
      userId,
      message: 'User name is required'
    });
  }
  
  return ok(data.value);
}

// Usage with proper error handling
async function displayUserProfile(userId: string) {
  const userData = await fetchUserData(userId);
  
  if (!userData.ok) {
    // Each error has context about where it happened
    switch (userData.error.type) {
      case 'NetworkError':
        console.error('Connection failed');
        break;
      case 'ParseError':
        console.error('Invalid response format');
        break;
      case 'ValidationError':
        console.error(userData.error.message);
        break;
    }
    return;
  }
  
  // Work with the data safely
  console.log(`Welcome, ${userData.value.name}!`);
}
```

---

## Feature checklist

| ✔ | Feature | Example |
|---|---------|---------|
| Typed constructors | `err('Timeout')({ ms: 2000 })` |
| `map`, `flatMap`, `or` | `ok(1).map(x=>x+1).flatMap(fn).or(0)` |
| Works with **Promise** | `await result(fetch(url))` |
| Cause‑chain + optional stack frame | `err(...).annotate('DB', {...})` |
| JSON serialisable & iterable | `JSON.stringify(err('X')())`, `[...ok(7)]` |
| Re‑hydrate after JSON | `const live = result(JSON.parse(raw))` |

---

## API reference

### Constructors

| function | purpose |
|----------|---------|
| `ok(value)` | success result |
| `err(kind)(payload?)` | typed error **+ trace** |
| `errAny(value)` | error without a discriminant / trace |
| `result(x)` | wrap a sync fn, a Promise, **or** re‑hydrate a raw object |

### Instance methods (on `Ok` & `Err`)

| method | on `Ok` | on `Err` |
|--------|---------|----------|
| `map(fn)` | transform value | no‑op |
| `mapErr(fn)` | no‑op | transform error |
| `flatMap(fn)` | chain another `Result` | propagate error |
| `unwrap()` | get value | throw error |
| `or(fallback)` | value | fallback |
| `[Symbol.iterator]()` | yields value | yields nothing |

### Instance Methods

* `.annotate(kind, payload?)` – add context + cause (on `Err` instances only)

### Types

```ts
type Result<T, E = unknown> = Ok<T> | Err<E>;
```

---

## JSON round‑trip example

```ts
const errOut = err('DbConn')({ host: 'db.local' });
const raw = JSON.stringify(errOut);

const back = result(JSON.parse(raw)); // re‑hydrated
for (const v of back) console.log(v); // nothing, because Err
```

## Error with cause example

```ts
// Create an error chain
const ioError = err('IO')({ errno: 'ENOENT' });
const configError = ioError.annotate('ConfigFileMissing', { path: '/etc/app.json' });
const bootError = configError.annotate('BootConfig', { phase: 'init' });

// Now you can navigate the error chain
console.log(bootError.error.type);    // 'BootConfig'
console.log(bootError.error.cause.type); // 'ConfigFileMissing'
```

---

## License

MIT