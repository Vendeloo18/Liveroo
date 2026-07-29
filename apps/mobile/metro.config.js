// Metro en un monorepo pnpm.
//
// pnpm no aplana node_modules: enlaza cada dependencia simbólicamente.
// Metro, por defecto, ni sigue esos enlaces ni mira fuera de la carpeta
// del proyecto, así que sin esto no resuelve @subastas-ve/shared ni las
// dependencias izadas a la raíz del workspace.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Vigilar todo el workspace: shared vive fuera de apps/mobile
config.watchFolders = [workspaceRoot];

// Buscar módulos aquí, en la raíz del workspace, y —clave— en el
// directorio hoisted del store virtual: ahí es donde pnpm deja
// accesibles las dependencias transitivas (expo-modules-core,
// @expo/log-box y compañía) que Expo importa sin declararlas.
//
// Esto evita tener que aplanar todo el monorepo con nodeLinker: hoisted,
// que rompe la web (ver la nota en pnpm-workspace.yaml).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules/.pnpm/node_modules"),
];

// Sin esto Metro sube por el árbol y puede tomar una copia distinta de React
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
