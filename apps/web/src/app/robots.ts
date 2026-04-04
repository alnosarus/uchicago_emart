import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/browse", "/posts/", "/profile/"],
        disallow: ["/auth", "/create", "/saved", "/history", "/posts/*/edit"],
      },
    ],
    sitemap: "https://www.uchicagoemart.com/sitemap.xml",
  };
}
