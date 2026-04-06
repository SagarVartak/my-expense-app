import { redirect } from "next/navigation";

/** Deep link: open home on the Orders tab (all orders). */
export default function OrdersRedirectPage() {
  redirect("/?nav=orders");
}
