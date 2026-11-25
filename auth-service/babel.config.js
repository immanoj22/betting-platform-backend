module.exports = {
    presets: [["@babel/preset-env", { targets: { node: "current" } }]],
    plugins: [
        "@babel/plugin-transform-runtime",
        "babel-plugin-transform-import-meta"
    ],
    // sourceType: "module",  // <-- This is important for import.meta to work
}