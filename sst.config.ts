/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "electric-workshop",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          profile: `marketing`,
        },
      },
    };
  },
  async run() {
    console.log(Object.keys(process.env).filter(a => a.includes(`ELECTRIC`)))
    const api = new sst.cloudflare.Worker(`api`, {
      handler: `./src/api.ts`,
      url: true,
      environment: {
        ELECTRIC_URL: `https://api.electric-sql.cloud`,
        ELECTRIC_SOURCE_ID: process.env.ELECTRIC_SOURCE_ID,
        ELECTRIC_SOURCE_SECRET: process.env.ELECTRIC_SOURCE_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
      }
    });

    const workshopApp = new sst.aws.StaticSite(`workshopApp`, {
      // domain: {
      //   name: dashboardDomain,
      //   dns: sst.cloudflare.dns(),
      // },
      environment: {
        VITE_API: api.url,
      },
      path: `.`,
      build: {
        command: `npm run build`,
        output: `dist`,
      },
      dev: {
        title: `app`,
        directory: `.`,
        command: `vite`,
        url: `http://localhost:5173`,
      },
    });

    return {
      app: workshopApp.url,
      api: api.url
    }
  },
});
