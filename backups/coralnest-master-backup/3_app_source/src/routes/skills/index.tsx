import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/skills/")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/flows",
      search: {
        ...search,
        tab: "skills",
      } as never,
      replace: true,
    });
  },
});
