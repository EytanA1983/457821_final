# Cypress E2E Testing

## Overview

Cypress is configured for End-to-End testing with support for:
- Authentication flows
- Room/Task CRUD operations
- WebSocket real-time updates
- Responsive testing
- Hebrew RTL support

## Getting Started

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Cypress

```bash
# Interactive mode (recommended for development)
npm run cypress

# Headless mode (for CI)
npm run cypress:run

# With dev server (starts Vite + Cypress)
npm run e2e:open   # Interactive
npm run e2e        # Headless
```

## Project Structure

```
frontend/cypress/
├── e2e/                    # E2E test specs
│   ├── auth.cy.ts         # Authentication tests
│   ├── rooms.cy.ts        # Room management tests
│   ├── tasks.cy.ts        # Task management tests
│   ├── user-flow.cy.ts    # Complete user journey
│   └── websocket.cy.ts    # Real-time updates tests
├── fixtures/              # Test data
│   ├── users.json
│   ├── rooms.json
│   └── tasks.json
├── support/
│   ├── commands.ts        # Custom commands
│   └── e2e.ts            # Global configuration
└── tsconfig.json         # TypeScript config
```

## Test Scenarios

### Authentication (`auth.cy.ts`)
- Registration form validation
- Successful registration
- Duplicate email handling
- Login with valid credentials
- Login with invalid credentials
- Session persistence
- Logout functionality
- Protected route access

### Rooms (`rooms.cy.ts`)
- Room list display
- Create room via UI
- Create room via API
- Room type detection (emoji mapping)
- Room navigation
- Progress bar display
- Delete room

### Tasks (`tasks.cy.ts`)
- Create task in room
- Task completion toggle
- Progress bar updates
- Task filtering
- Task deletion

### User Flow (`user-flow.cy.ts`)
Complete journey:
1. Register new user
2. Login
3. Create room
4. Add task
5. Add todo
6. Complete todo
7. Verify progress
8. Logout

### WebSocket (`websocket.cy.ts`)
- Connection establishment
- Authentication via token
- Real-time task updates
- Real-time room progress
- Multi-device sync simulation
- Offline handling

## Custom Commands

### Authentication

```typescript
// Login via UI
cy.login('user@example.com', 'password');

// Login via API (faster)
cy.loginViaApi('user@example.com', 'password');

// Register new user
cy.register('user@example.com', 'password', 'User Name');

// Logout
cy.logout();
```

### CRUD Operations

```typescript
// Create room
cy.createRoom('סלון').then((roomId) => {
  // Use roomId
});

// Create task
cy.createTask(roomId, 'Task Title', 'Description').then((taskId) => {
  // Use taskId
});

// Create todo
cy.createTodo(taskId, 'Todo Title').then((todoId) => {
  // Use todoId
});
```

### WebSocket

```typescript
// Setup WebSocket connection
cy.setupWebSocket().then((ws) => {
  // WebSocket is connected
});

// Wait for WebSocket message
cy.waitForWsMessage(5000).then((message) => {
  // Handle message
});
```

### Utilities

```typescript
// Get element by data-testid
cy.getByTestId('room-card');

// Contains Hebrew text
cy.containsHebrew('חדר');
```

## Configuration

### `cypress.config.ts`

```typescript
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5179',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      apiUrl: 'http://localhost:8000',
    },
  },
});
```

## Best Practices

### 1. Use Data Attributes

Add `data-testid` attributes to components:

```tsx
<button data-testid="submit-button">Submit</button>
```

Then in tests:

```typescript
cy.getByTestId('submit-button').click();
```

### 2. API for Setup, UI for Testing

Use API calls for test setup, test the UI:

```typescript
// Good: Fast setup
cy.loginViaApi('user@example.com', 'password');
cy.createRoom('Test Room');

// Then test the UI
cy.visit('/home');
cy.contains('Test Room').should('be.visible');
```

### 3. Handle Async Operations

Always wait for operations to complete:

```typescript
// Wait for API
cy.wait('@apiPost');

// Wait for element
cy.contains('Text', { timeout: 10000 }).should('be.visible');
```

### 4. Clean State

Each test should be independent:

```typescript
beforeEach(() => {
  cy.clearLocalStorage();
  cy.loginViaApi('user@example.com', 'password');
});
```

### 5. Use Fixtures

Store test data in fixtures:

```typescript
cy.fixture('users.json').then((users) => {
  cy.login(users.validUser.email, users.validUser.password);
});
```

## CI Integration

### GitHub Actions

```yaml
cypress:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - name: Install dependencies
      run: npm ci
    - name: Cypress run
      uses: cypress-io/github-action@v6
      with:
        working-directory: frontend
        start: npm run dev
        wait-on: 'http://localhost:5179'
```

## Debugging

### Screenshots

Screenshots are saved on failure:
```
cypress/screenshots/
```

### Videos

Videos are recorded for each run:
```
cypress/videos/
```

### Logs

```typescript
cy.log('Debug message');
cy.task('log', 'Server-side log');
```

## Troubleshooting

### Tests Timing Out

Increase timeout:

```typescript
cy.contains('Text', { timeout: 15000 });
```

### WebSocket Issues

Check that backend is running and token is valid.

### Flaky Tests

Add retries in config or use `cy.wait()` for async operations.

## Resources

- [Cypress Documentation](https://docs.cypress.io/)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Real World App Example](https://github.com/cypress-io/cypress-realworld-app)
