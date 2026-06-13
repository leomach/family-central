import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Central da Família",
    short_name: "Família",
    description: "Gestão financeira e objetivos do lar",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/api/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/api/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/api/icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Nova despesa",
        short_name: "Despesa",
        url: "/financeiro?action=new-expense",
        icons: [{ src: "/api/icon/96", sizes: "96x96" }],
      },
      {
        name: "Nova receita",
        short_name: "Receita",
        url: "/financeiro?action=new-income",
        icons: [{ src: "/api/icon/96", sizes: "96x96" }],
      },
      {
        name: "Lista de compras",
        short_name: "Compras",
        url: "/compras",
        icons: [{ src: "/api/icon/96", sizes: "96x96" }],
      },
    ],
  }
}
