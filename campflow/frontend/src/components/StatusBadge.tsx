const COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-indigo-100 text-indigo-700",
  INTERESTED: "bg-purple-100 text-purple-700",
  FOLLOW_UP: "bg-amber-100 text-amber-700",
  PAYMENT_PENDING: "bg-orange-100 text-orange-700",
  CONFIRMED: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-200 text-gray-700",
  LOST: "bg-red-100 text-red-700",
  HOT: "bg-red-100 text-red-700",
  WARM: "bg-amber-100 text-amber-700",
  COLD: "bg-blue-100 text-blue-700",
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-gray-200 text-gray-700",
  OPEN: "bg-green-100 text-green-700",
  FULL: "bg-orange-100 text-orange-700",
  DRAFT: "bg-gray-200 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${COLORS[value] || "bg-gray-100 text-gray-700"}`}>{value.replace("_", " ")}</span>;
}
