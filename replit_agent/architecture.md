# PatrolD - Architecture Documentation

## Overview

PatrolD is a modern uptime monitoring platform designed to track the health and performance of network services, servers, and websites. The system uses a distributed architecture with central monitoring servers and remote agents that collect and report service status information. 

The application follows a typical full-stack web application architecture with a React frontend, Node.js backend, and PostgreSQL database for persistence. It uses a distributed agent model where lightweight monitoring agents can be deployed to various environments to monitor services locally.

## System Architecture

### High-Level Architecture

PatrolD follows a client-server architecture with distributed agents:

1. **Web UI (Frontend)**: A React-based single-page application that provides the user interface for configuration and visualization.
2. **API Server (Backend)**: A Node.js Express server that handles API requests, authentication, and core business logic.
3. **Database**: PostgreSQL for persistent storage of monitoring data, user settings, and configuration.
4. **Monitoring Agents**: Lightweight programs that can be installed on remote servers to perform health checks and report status back to the central server.
5. **Notification Services**: Integration with services like Telegram for alerts and notifications.

### Request Flow

1. User interacts with the React frontend
2. Frontend makes API calls to the Express backend
3. Backend processes requests, interacts with the database, and returns responses
4. Agents deployed on remote servers independently check services and report back to the API
5. When service status changes, notifications are sent through integration channels

## Key Components

### Frontend

- **Technology**: React with TypeScript
- **UI Framework**: Custom UI components built with Radix UI primitives and styled with Tailwind CSS
- **State Management**: React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Key Features**:
  - Dashboard with service monitoring visualization
  - Service management interface
  - Alerts and notification management
  - Agent management
  - User settings and authentication
  - Service maps for visualizing infrastructure

### Backend

- **Technology**: Node.js with Express
- **API Layer**: RESTful API endpoints for frontend communication
- **Authentication**: Session-based authentication with Passport.js
- **Real-time Monitoring**: Continuous service monitoring handled by a monitoring service
- **Database Access**: Drizzle ORM for database operations with PostgreSQL 
- **Key Features**:
  - User authentication and authorization
  - Service monitoring and status tracking
  - Alert generation and management
  - Agent registration and management
  - Telegram bot integration for notifications

### Database Schema

The application uses a relational database (PostgreSQL) with the following core entities:

- **Users**: Stores user accounts and authentication information
- **Services**: Represents monitored services with configuration and status
- **Connections**: Represents relationships between services
- **Alerts**: Records of incidents and status changes
- **Agents**: Remote monitoring agents that perform health checks
- **User Settings**: User-specific configuration, including notification preferences
- **Service Maps**: Custom visualizations of service topologies
- **Shared Maps**: Maps that can be shared publicly or with specific access controls

### Monitoring Agents

- **Languages**: Multiple agent implementations (Python, Node.js, Bash)
- **Packaging**: Distributable as Debian packages (.deb) for easy installation
- **Configuration**: JSON-based configuration stored in `/etc/patrold/config.json`
- **Deployment**: Systemd service for automatic startup and management
- **Key Features**:
  - Periodic service health checks
  - Heartbeat reporting
  - Various check types (TCP, HTTP, HTTPS)
  - Automatic recovery from failures

## Data Flow

### Monitoring Flow

1. Agents are installed on remote servers and register with the central server
2. Agents periodically check configured services and report status to the API
3. The API server processes reports and updates service status in the database
4. When a status change is detected, alerts are generated
5. Notifications are sent through configured channels (e.g., Telegram)
6. The frontend polls for updates and reflects the current status

### Authentication Flow

1. Users register or log in through the web interface
2. The backend authenticates users and establishes sessions
3. Session tokens are stored in cookies and verified on subsequent requests
4. Access to resources is restricted based on user ownership

## External Dependencies

### Core Dependencies

- **@neondatabase/serverless**: Database connectivity for PostgreSQL
- **drizzle-orm**: Database ORM for type-safe database access
- **express**: Web framework for the backend
- **passport**: Authentication middleware
- **connect-pg-simple**: PostgreSQL-based session store
- **node-telegram-bot-api**: Telegram integration for notifications

### Frontend Dependencies

- **React**: UI library
- **@tanstack/react-query**: Data fetching and caching
- **wouter**: Client-side routing
- **radix-ui**: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **shadcn/ui**: Component library patterns built on Radix UI
- **lucide-react**: Icon library

### Development Dependencies

- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and development server
- **esbuild**: JavaScript bundler
- **drizzle-kit**: Database migration and schema management

## Deployment Strategy

The application supports multiple deployment options:

### Container-based Deployment

- **Docker**: Dockerfile is provided for containerized deployment
- **Multi-stage build**: Optimized container size with separate build and runtime stages
- **Environment Variables**: Configuration through environment variables

### Traditional Deployment

- **Node.js**: Requires Node.js 20.x runtime
- **PostgreSQL**: Requires PostgreSQL 14.x or later
- **Process Management**: PM2 for process management and automatic restart

### Agent Deployment

- **Debian Package**: Agents can be deployed via .deb packages
- **Manual Installation**: Scripts are available for manual installation
- **Systemd Integration**: Runs as a system service for reliability

### CI/CD Pipeline

- **GitLab CI**: Configuration for automated building and deployment
- **Build Process**: Compiles TypeScript, bundles assets, creates Debian packages
- **Database Migration**: Automatically applies database schema changes during deployment

## Security Considerations

- **Authentication**: Session-based authentication with secure cookies
- **Password Storage**: Passwords are hashed using scrypt with unique salts
- **API Security**: Protected routes require authentication
- **Agent Authentication**: Agents use API keys for secure communication
- **Shared Maps**: Optional password protection for publicly shared service maps