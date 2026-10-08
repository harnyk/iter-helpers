import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
    title: "Iter Helpers",
    tagline: "Composable operators for synchronous and asynchronous iterators",
    favicon: "img/favicon.svg",

    url: "https://harnyk.github.io",
    baseUrl: "/iter-helpers/",
    organizationName: "harnyk",
    projectName: "iter-helpers",
    trailingSlash: false,

    onBrokenLinks: "throw",
    markdown: {
        // plain CommonMark: the text contains `{ }` and `<` that MDX would parse
        format: "detect",
        mermaid: true,
        hooks: {
            onBrokenMarkdownLinks: "throw",
        },
    },
    themes: ["@docusaurus/theme-mermaid"],

    plugins: [
        [
            "docusaurus-plugin-typedoc",
            {
                entryPoints: ["../src/main.ts"],
                tsconfig: "../tsconfig.json",
                out: "docs/api",
                readme: "none",
                entryFileName: "index",
                hidePageHeader: true,
                hideBreadcrumbs: true,
                // plain names in titles: the default templates leave escaped
                // generics (`Chain\<I\>`) in the browser tab and the sidebar
                pageTitleTemplates: { member: "{rawName}" },
                validation: { notExported: false },
                sidebar: { autoConfiguration: false },
            },
        ],
    ],

    presets: [
        [
            "classic",
            {
                docs: {
                    routeBasePath: "/",
                    sidebarPath: "./sidebars.ts",
                    // the API pages are generated from the TSDoc: nothing to edit
                    editUrl: ({ docPath }) =>
                        docPath.startsWith("api/")
                            ? undefined
                            : `https://github.com/harnyk/iter-helpers/tree/master/website/docs/${docPath}`,
                },
                blog: false,
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        colorMode: {
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: "Iter Helpers",
            items: [
                {
                    type: "docSidebar",
                    sidebarId: "docs",
                    position: "left",
                    label: "Docs",
                },
                {
                    to: "/api",
                    label: "API",
                    position: "left",
                },
                {
                    href: "https://www.npmjs.com/package/@harnyk/iter-helpers",
                    label: "npm",
                    position: "right",
                },
                {
                    href: "https://github.com/harnyk/iter-helpers",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        footer: {
            style: "dark",
            copyright: `MIT License. Copyright © 2023-${new Date().getFullYear()} Mark Harnyk and contributors.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
