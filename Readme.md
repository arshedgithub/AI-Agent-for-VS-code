AI Agent for VS code
================================================================

- This will analyze your project and understand the project architecture
- User can ask to implement feature from this plugin
- And this plugin will send user query to DIFY model


How to Run this plugin in development environment
================================================================

1. Clone the project
2. Install dependencies using 'npm install' command
3. Rename config.secure.copy.ts into config.secure.ts which was in src/config/ directory
4. Add DIFY API key and API URL into config.secure.ts
5. Compile typescript using 'npm run compile' command
6. Head into /src/extesion.ts in VS code
7. Press F5 or Go to Run and Debug in VS code