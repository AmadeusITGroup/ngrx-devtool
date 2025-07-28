# NgRx DevTool - Architecture Visualization Tool

A powerful development tool for visualizing and debugging NgRx state management in Angular applications.

## 🚀 Overview

This tool provides real-time monitoring and visualization of NgRx actions, state changes, and application architecture. It consists of a library package and a standalone UI application for comprehensive state debugging.

![NgRx DevTool Demo](assets/devtool-on-pct.gif)

## 📦 Project Structure

- **ngrx-devtool** - Core library package
- **ngrx-devtool-ui** - Standalone visualization application  
- **ngrx-devtool-demo** - Example implementation


## 🛠️ Installation & Setup

> **Note**: The library is not yet published to npm. Follow these steps to set up the development environment:

### 1. Clone the repository
```bash
git clone <repository-url>
cd ngrx-devtool-proto
```

### 2. Install dependencies
```bash
npm install
```

### 3. Build and run the library in watch mode
```bash
cd projects/ngrx-devtool
ng build --watch
```

### 4. Run the WebSocket server and UI
```bash
# At the root directory
npm run build 
node ./dist/index.js
```
Access the UI at **port 3000**.

### 5. (Optional) Run UI in development mode
```bash
cd projects/ngrx-devtool-ui
ng serve
```
Access the UI at **port 4200** for automatic code reloading.

### 6. Run the demo application
```bash
cd projects/ngrx-devtool-demo
ng serve
```

## 🎯 Features

- **Real-time Action Monitoring** - Track all dispatched actions
- **State Visualization** - View current and previous states
- **Diff Viewer** - Compare state changes between actions
- **WebSocket Integration** - Live connection to development UI
- **JSON Tree Display** - Hierarchical state exploration

This project is actively under development.


## 🔧 Configuration

The tool connects to WebSocket on `localhost:4000` by default. Ensure your backend supports WebSocket connections for real-time updates.

## 📖 Documentation

For detailed architecture documentation and advanced usage patterns, visit:
[Official Documentation](https://amadeus.atlassian.net/wiki/spaces/OACD/pages/2784796572/WG+-+Architecture+Visualization+tool+for+Angular+Redux+web-applications)

## 🏗️ UI Components

- **Action List** - Expandable panels for each dispatched action
- **Tabbed Views** - Action details, state snapshots, and diffs
- **Material Design** - Clean, professional interface using Angular Material

## 🔍 Usage

1. Follow the installation steps above to set up the development environment
2. Start the library in watch mode
3. Launch the WebSocket server and UI
4. Run the demo application
5. Monitor real-time updates in the DevTool interface

## 🤝 Contributing

We welcome contributions! To get started:

1. Fork the repository
2. Follow the installation steps above
3. Make your changes
4. Test with the demo application
5. Submit a pull request

Please ensure your code follows the existing style and includes appropriate tests.





