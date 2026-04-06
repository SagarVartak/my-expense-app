import { redirect } from "next/navigation";

/** Old URL: open home on the Saved designs tab. */
export default function SavedDesignsRedirectPage() {
  redirect("/?nav=savedDesigns");
}
