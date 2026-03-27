export function exportGenericCSV(filename: string, headers: string[], rows: string[][]) {
  const allRows = [headers, ...rows];
  const csv = allRows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportStylistCSV(data: any[], dateLabel: string) {
  const headers = ["Name", "Total Appointments", "Completed", "Revenue", "Avg Ticket", "Cancellation %", "No-Show %"];
  const rows = data.map(s => [
    s.name, String(s.totalAppointments), String(s.completedAppointments),
    `$${s.revenue.toFixed(2)}`, `$${s.avgTicket.toFixed(2)}`,
    `${s.cancellationRate.toFixed(1)}%`, `${s.noShowRate.toFixed(1)}%`,
  ]);
  exportGenericCSV(`stylist-productivity-${dateLabel}.csv`, headers, rows);
}

export function exportChairCSV(data: any[], dateLabel: string) {
  const headers = ["Staff", "Revenue", "Appointments", "Booked Min", "Available Min", "Utilization %"];
  const rows = data.map(c => [
    c.name, `$${c.revenue.toFixed(2)}`, String(c.appointmentCount),
    String(c.bookedMinutes), String(c.availableMinutes), `${c.utilizationPct.toFixed(1)}%`,
  ]);
  exportGenericCSV(`revenue-per-chair-${dateLabel}.csv`, headers, rows);
}

export function exportRetailCSV(services: any[], dateLabel: string) {
  const headers = ["Service", "Category", "Unit Price", "Qty Sold", "Revenue", "Top Seller"];
  const rows = services.map(s => [
    s.name, s.category, `$${s.unitPrice.toFixed(2)}`,
    String(s.qty), `$${s.revenue.toFixed(2)}`, s.isTopSeller ? "Yes" : "No",
  ]);
  exportGenericCSV(`retail-sales-${dateLabel}.csv`, headers, rows);
}

export function exportMultiLocationCSV(data: any[], dateLabel: string) {
  const headers = ["Location", "Address", "Revenue", "Appointments", "Cancellation %", "No-Shows", "Avg Rating"];
  const rows = data.map(l => [
    l.name, l.address ?? "", `$${l.revenue.toFixed(2)}`,
    String(l.appointments), `${l.cancellationRate.toFixed(1)}%`,
    String(l.noShows), l.avgRating ? l.avgRating.toFixed(1) : "N/A",
  ]);
  exportGenericCSV(`multi-location-${dateLabel}.csv`, headers, rows);
}
