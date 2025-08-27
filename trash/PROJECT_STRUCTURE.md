# Communication Server - Project Structure

## 📁 Directory Organization

```
communication-server/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── server.ts                   # Server class and lifecycle
│   ├── server/                     # Server-specific modules
│   │   ├── index.ts               # Barrel exports
│   │   ├── config.ts              # Configuration management
│   │   ├── server-manager.ts      # Server lifecycle management
│   │   └── tools-definition.ts    # MCP tool schemas
│   ├── domain/                     # Business logic and models
│   │   ├── index.ts               # Barrel exports
│   │   ├── agents/                # Agent domain models
│   │   │   ├── models.ts          # Agent entity models
│   │   │   ├── interfaces.ts      # Agent interfaces
│   │   │   ├── enums.ts           # Agent enums
│   │   │   └── factories.ts       # Agent factories
│   │   ├── messages/              # Message domain models
│   │   │   └── message.ts         # Message entity
│   │   └── conversations/         # Conversation domain models
│   │       └── conversation.ts    # Conversation entity
│   ├── application/                # Use cases and handlers
│   │   ├── index.ts               # Barrel exports
│   │   ├── handlers/              # MCP tool handlers
│   │   │   ├── server-tools.ts    # Main tool dispatcher
│   │   │   ├── agent-handler.ts   # Agent operations
│   │   │   ├── communication-handler.ts # Communication operations
│   │   │   ├── message-handler.ts # Message operations
│   │   │   ├── system-handler.ts  # System operations
│   │   │   └── tool-handler.ts    # Tool operations
│   │   └── validators/            # Input validation
│   │       ├── agent-validator.ts # Agent validation
│   │       └── message-validator.ts # Message validation
│   ├── services/                   # Business operations
│   │   ├── index.ts               # Barrel exports
│   │   ├── agent-monitor.ts       # Agent monitoring service
│   │   └── communication/         # Communication services
│   │       ├── message-queue.ts   # Message queuing
│   │       ├── conversation-thread.ts # Thread management
│   │       ├── search-engine.ts   # Message search
│   │       └── conversation-manager.ts # Conversation management
│   ├── infrastructure/             # External concerns
│   │   ├── index.ts               # Barrel exports
│   │   ├── database/              # Data persistence
│   │   │   ├── database.js        # Database manager
│   │   │   └── schema.js          # Database schema
│   │   ├── security/              # Security management
│   │   │   └── security.js        # Security operations
│   │   └── analytics/             # Analytics and monitoring
│   │       ├── analytics.js       # Analytics manager
│   │       ├── rate-limiter.js    # Rate limiting
│   │       ├── events-manager.js  # Event management
│   │       └── message-analytics.js # Message analytics
│   └── shared/                     # Shared utilities
│       ├── index.ts               # Barrel exports
│       ├── logger.ts              # Logging system
│       ├── error-handler.ts       # Error handling
│       ├── constants/             # Application constants
│       │   └── index.ts           # Constants definitions
│       ├── types/                 # Shared types
│       │   └── common.ts          # Common type definitions
│       └── utils/                 # Utility functions
│           └── utils.ts           # Utility functions
├── dist/                          # Compiled JavaScript
├── trash/                         # Removed files (backup)
├── examples/                      # Usage examples
├── tests/                         # Test files
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── README.md                      # Project documentation
├── PROJECT_STRUCTURE.md           # This file
├── IMPROVEMENTS_SUMMARY.md        # Feature improvements
└── mcp_example.json               # MCP configuration example
```

## 🏗️ Architecture Layers

### **Domain Layer** (`src/domain/`)
- **Purpose**: Pure business logic, no external dependencies
- **Contains**: Entities, value objects, domain services, business rules
- **Dependencies**: None (pure TypeScript)

### **Application Layer** (`src/application/`)
- **Purpose**: Use cases, orchestration, input validation
- **Contains**: Handlers, validators, use case implementations
- **Dependencies**: Domain layer, Services layer

### **Services Layer** (`src/services/`)
- **Purpose**: Business operations and orchestration
- **Contains**: Service classes, business logic coordination
- **Dependencies**: Domain layer, Infrastructure layer

### **Infrastructure Layer** (`src/infrastructure/`)
- **Purpose**: External concerns, data persistence, security
- **Contains**: Database, security, analytics, external APIs
- **Dependencies**: Domain layer

### **Shared Layer** (`src/shared/`)
- **Purpose**: Cross-cutting concerns, utilities
- **Contains**: Logging, error handling, constants, types, utilities
- **Dependencies**: None (pure utilities)

## 🔄 Import Rules

### **Allowed Dependencies**
- **Domain** → No dependencies (pure)
- **Application** → Domain, Services, Shared
- **Services** → Domain, Infrastructure, Shared
- **Infrastructure** → Domain, Shared
- **Shared** → No dependencies (pure utilities)

### **Barrel Exports**
Each layer has an `index.ts` file that exports all public APIs:
- Cleaner imports: `import { Something } from '../layer/index.js'`
- Better encapsulation: Only export what's needed
- Easier refactoring: Change internal structure without affecting imports

## 📦 Module Organization

### **Server Module** (`src/server/`)
- **config.ts**: Centralized configuration management
- **server-manager.ts**: Server lifecycle and initialization
- **tools-definition.ts**: MCP tool schema definitions

### **Domain Module** (`src/domain/`)
- **agents/**: Agent-related domain models
- **messages/**: Message-related domain models
- **conversations/**: Conversation-related domain models

### **Application Module** (`src/application/`)
- **handlers/**: MCP tool request handlers
- **validators/**: Input validation logic

### **Services Module** (`src/services/`)
- **communication/**: Communication-related services
- **agent-monitor.ts**: Agent monitoring and tracking

### **Infrastructure Module** (`src/infrastructure/`)
- **database/**: Data persistence layer
- **security/**: Security and authentication
- **analytics/**: Monitoring and analytics

### **Shared Module** (`src/shared/`)
- **logger.ts**: Centralized logging system
- **error-handler.ts**: Error handling and reporting
- **constants/**: Application constants
- **types/**: Shared type definitions
- **utils/**: Utility functions

## 🎯 Benefits of This Structure

1. **Clean Architecture**: Clear separation of concerns
2. **Maintainability**: Easy to find and modify code
3. **Testability**: Each layer can be tested independently
4. **Scalability**: Easy to add new features
5. **Dependency Management**: Clear import rules prevent circular dependencies
6. **Barrel Exports**: Clean imports and better encapsulation
7. **Modularity**: Each module has a single responsibility

## 🚀 Development Workflow

1. **Domain Changes**: Start with domain models and business rules
2. **Application Changes**: Add use cases and handlers
3. **Service Changes**: Implement business operations
4. **Infrastructure Changes**: Add external integrations
5. **Shared Changes**: Update utilities and cross-cutting concerns

This structure ensures the codebase remains clean, maintainable, and scalable as the project grows.
