import localFont from "next/font/local";

export const interDisplay = localFont({
  src: [
    {
      path: "../../node_modules/inter-ui/display-latin/InterDisplay-Regular-subset.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/inter-ui/display-latin/InterDisplay-Medium-subset.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/inter-ui/display-latin/InterDisplay-SemiBold-subset.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/inter-ui/display-latin/InterDisplay-Bold-subset.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter-display",
  display: "swap",
});
