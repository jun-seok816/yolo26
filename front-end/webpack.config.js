const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const base = require("./webpack.base");

module.exports = merge(base, {
  entry: { index: "./src/index.tsx" },
  output: {
    path: path.resolve(__dirname, "../back-end/build"),
    filename: "index.js",
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      templateContent: /* html */ `
      <html>
        <head>          
          <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">          
          <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
          <meta http-equiv="Pragma" content="no-cache">
          <meta http-equiv="Expires" content="0">
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">          
          <title>Token</title>
          <base href="/">                    
        </head>         
        <body style="margin: 0; padding: 0; width: 100%; height: 100%;"> 
          <div id="app">
                   
          </div>          
        </body>
      </html>
      `,
    }),
  ],
});
