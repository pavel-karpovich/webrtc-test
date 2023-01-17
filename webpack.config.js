const path = require("path");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');


module.exports = {
    entry: './src/client.js',
    output: {
        filename: "index.js",
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src', 'index.html'),
            filename: 'index.html',
            inject: true,
        }),
        new CopyWebpackPlugin({
            patterns: [
                {from: 'public', to: 'dist'},
            ],
        }),
    ],
    mode: 'development',
    devServer: {
        open: true,
        port: 5001,
    },
};
