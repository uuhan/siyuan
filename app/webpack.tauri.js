const path = require("path");
const webpack = require("webpack");
const pkg = require("./package.json");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const {EsbuildPlugin} = require("esbuild-loader");

module.exports = (env, argv) => {
    return {
        mode: argv.mode || "development",
        watch: argv.mode !== "production",
        devtool: argv.mode !== "production" ? "eval-source-map" : false,
        output: {
            publicPath: "/stage/build/app/",
            filename: "[name].[chunkhash].js",
            path: path.resolve(__dirname, "stage/build/app"),
        },
        entry: {
            "main": "./src/index.ts",
        },
        optimization: {
            minimize: argv.mode === "production",
            minimizer: [
                new EsbuildPlugin({
                    target: "es6",
                    sourcemap: argv.mode !== "production",
                }),
            ],
        },
        resolve: {
            fallback: {
                "path": require.resolve("path-browserify"),
                "fs": false,
            },
            alias: {
                "electron": false,
            },
            extensions: [".ts", ".js", ".tpl", ".scss"],
        },
        module: {
            rules: [
                {
                    test: /\.tpl/,
                    include: [
                        path.resolve(__dirname, "src/assets/template/desktop/index.tpl")],
                    loader: "html-loader",
                    options: {
                        sources: false,
                    },
                },
                {
                    test: /\.ts(x?)$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "es6",
                                sourcemap: argv.mode !== "production",
                            }
                        },
                        {
                            loader: "ifdef-loader",
                            options: {
                                "ifdef-verbose": false,
                                BROWSER: false,
                                MOBILE: false,
                                TAURI: true,
                            },
                        },
                    ],
                },
                {
                    test: /\.scss$/,
                    include: [
                        path.resolve(__dirname, "src/assets/scss"),
                    ],
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader",
                            options: {
                                sourceMap: argv.mode !== "production",
                            },
                        },
                        {
                            loader: "sass-loader",
                            options: {
                                sourceMap: argv.mode !== "production",
                            },
                        },
                    ],
                },
                {
                    test: /\.(png|svg)$/,
                    use: [
                        {
                            loader: "file-loader",
                            options: {
                                name: "[name].[ext]",
                                outputPath: "../../",
                            },
                        },
                    ],
                },
            ],
        },
        plugins: [
            new CleanWebpackPlugin({
                cleanStaleWebpackAssets: false,
                cleanOnceBeforeBuildPatterns: [
                    path.join(__dirname, "stage/build/app")],
            }),
            new webpack.DefinePlugin({
                SIYUAN_VERSION: JSON.stringify(pkg.version),
                NODE_ENV: JSON.stringify(argv.mode),
            }),
            new MiniCssExtractPlugin({
                filename: "base.[contenthash].css",
            }),
            new HtmlWebpackPlugin({
                inject: "head",
                chunks: ["main"],
                filename: "index.html",
                template: "src/assets/template/desktop/index.tpl",
            }),
        ],
    };
};
