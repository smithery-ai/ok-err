# `okay-error`

[![NPM Version](https://img.shields.io/npm/v/okay-error?style=flat-square)](https://www.npmjs.com/package/okay-error)

> **Typed, chain‑friendly, JSON‑safe Results for TypeScript**  

A small opinionated TypeScript library providing strongly-typed `Result` objects with chaining capabilities, inspired by Rust `std::result`.

## Why *okay-error*?

* **Plain object compatibility** - an `Ok` is `{ ok: true, value }`, an `Err` is `{ ok: false, error }`. Log it, persist it, send it over the wire.
* **Type‑level errors** - every possible failure is visible in the function signature (`Result<T, E>`), not thrown from the shadows. Rely on the type checker to ensure you handle every possible failure.
* **Cause‑chain built‑in** - wrap lower‑level errors with the `annotate` function; walk the `cause` links later to see the full logical call stack.
* **Ergonomic** - helpers `map`, `flatMap`, `or` feel familiar to JS arrays.
* **Re‑hydration** - after `JSON.parse`, call `result` to get a plain `Result` object.

---

## Table of Contents

- [`okay-error`](#okay-error)
  - [Why *okay-error*?](#why-okay-error)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [Quick tour](#quick-tour)
    - [From try-catch to Result](#from-try-catch-to-result)
    - [Propagating context](#propagating-context)
      - [How annotation works](#how-annotation-works)
    - [Working with async operations](#working-with-async-operations)
  - [Feature checklist](#feature-checklist)
  - [API reference](#api-reference)
    - [Constructors](#constructors)
    - [Functions](#functions)
    - [Types](#types)
  - [JSON round‑trip example](#json-roundtrip-example)
  - [Error with cause example](#error-with-cause-example)
  - [Pattern matching example](#pattern-matching-example)
    - [Pattern matching with `match`](#pattern-matching-with-match)
    - [Type Safety and Exhaustiveness](#type-safety-and-exhaustiveness)
  - [License](#license)

---

## Install

```bash
npm i okay-error
```

---

## Quick tour

### From try-catch to Result

Here's how `okay-error` changes error handling from exceptions to data:

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
import { ok, err, result, annotate } from 'okay-error';

// Define functions that return Result types
function getUserById(id: number) {
  try {
    if (id <= 0) {
      return err('InvalidId', { id });
    }
    // Simulating database lookup
    const user = { id, name: 'Ada' };
    return ok(user);
  } catch (error) {
    // Convert any unexpected errors
    return err('DbError', { cause: error });
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
      : err('NameTooShort', { min: 1 })   // Return Err for failure
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
    return annotate(cfg, 'BootConfig', { phase: 'init' });
  }
  return ok();
}
```

#### How annotation works

`annotate` creates a new error that wraps the original error:

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

`okay-error` can be used with async code to handle errors as data:

```ts
import { result } from 'okay-error';

// Wrap fetch with Result to handle both network and parsing errors
async function fetchUserData(userId: string) {
  // First, handle the network request
  const response = await result(fetch(`/api/users/${userId}`));
  if (!response.ok) {
    return annotate(response, 'NetworkError', { userId });
  }
  
  // Then handle the JSON parsing
  const data = await result(response.value.json());
  if (!data.ok) {
    return annotate(data, 'ParseError', { userId });
  }
  
  // Validate the data
  if (!data.value.name) {
    return err('ValidationError', { 
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

| ✔                                  | Feature                                 | Example |
| ---------------------------------- | --------------------------------------- | ------- |
| Typed constructors                 | `err('Timeout', { ms: 2000 })`          |
| `map`, `flatMap`, `or`             | `ok(1).map(x=>x+1).flatMap(fn).or(0)`   |
| Works with **Promise**             | `await result(fetch(url))`              |
| Cause‑chain + optional stack frame | `annotate(err(...), 'DB', {...})`       |
| JSON serialisable                  | `JSON.stringify(err('X', {}))`          |
| Re‑hydrate after JSON              | `const plain = result(JSON.parse(raw))` |

---

## API reference

### Constructors

| function              | purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `ok(value)`           | success result                                            |
| `err(type, payload?)` | typed error **+ trace**                                   |
| `errAny(value)`       | error without a discriminant / trace                      |
| `result(x)`           | wrap a sync fn, a Promise, **or** re‑hydrate a raw object |

### Functions

| function                           | purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| `annotate(result, type, payload?)` | add context + cause                                 |
| `match(result, { ok, err })`       | pattern match on Result (success/failure)           |
| `match(type, cases)`               | pattern match on a discriminant string (exhaustive) |

### Types

```ts
type Result<T, E = unknown> = Ok<T> | Err<E>;
```

---

## JSON round‑trip example

```ts
const errOut = err('DbConn', { host: 'db.local' });
const raw = JSON.stringify(errOut);

const back = result(JSON.parse(raw)); // re‑hydrated
```

## Error with cause example

```ts
// Create an error chain
const ioError = err('IO', { errno: 'ENOENT' });
const configError = annotate(ioError, 'ConfigFileMissing', { path: '/etc/app.json' });
const bootError = annotate(configError, 'BootConfig', { phase: 'init' });

// Now you can navigate the error chain
console.log(bootError.error.type);    // 'BootConfig'
console.log(bootError.error.cause.type); // 'ConfigFileMissing'
```

## Pattern matching example

### Pattern matching with `match`

The `match` function is overloaded:
- Use `match(result, { ok, err })` to branch on Result objects.
- Use `match(type, { ...cases })` to branch on discriminant string unions (exhaustive, type-safe).
- `matchType` is now an alias for the discriminant string overload for backwards compatibility.

```ts
// Result matching
const result = divide(10, 2);
const message = match(result, {
  ok: (value) => `Result: ${value}`,
  err: (error) => `Error: ${error.message}`
});

console.log(result); // "Result: 5"

// With an error case
const errorResult = divide(10, 0).match({
  ok: (value) => `Result: ${value}`,
  err: (error) => `Error: ${error.message}`
});

console.log(errorResult); // "Error: Cannot divide by zero"
```


### Type Safety and Exhaustiveness

When using `match` with a discriminant string union, TypeScript will enforce exhaustiveness, ensuring you handle all possible cases. This provides an additional layer of type safety for error handling.

```ts
// Define a discriminated union of error types
type ApiError =
  | { type: 'NotFound'; id: string }
  | { type: 'Timeout'; ms: number }
  | { type: 'Unauthorized'; reason: string };

// Function that returns different error types
function fetchData(id: string): Result<{ name: string }, ApiError> {
  // ...
}

// Use match to handle each error type differently
const response = fetchData('slow');

if (!response.ok) {
  const errorMessage = match(response.error.type, {
    NotFound: () => `Item ${response.error.id} could not be found`,
    Timeout: () => `Request timed out after ${response.error.ms}ms`,
    Unauthorized: () => `Access denied: ${response.error.reason}`
  });
  
  console.log(errorMessage); // "Request timed out after 5000ms"
}

// Warning: match requires a discriminated union
// If you're not using a discriminated union, use match instead
```

## License

MIT