const DAY = 86400000;

function beijingDate(timestamp = Date.now()) {
  return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10);
}

function groupBookings(bookings, today, showAll) {
  const weekStart = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * DAY).toISOString().slice(0, 10);
  const visible = bookings.filter(item => showAll || item.status === 'active');
  const byTime = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  return {
    todayBookings: visible.filter(item => item.date === today).sort(byTime),
    futureBookings: visible.filter(item => item.date > today).sort(byTime),
    pastWeekBookings: showAll ? visible.filter(item => item.date >= weekStart && item.date < today).sort((a, b) => byTime(b, a)) : [],
    olderBookings: showAll ? visible.filter(item => !item.date || item.date < weekStart).sort((a, b) => byTime(b, a)) : []
  };
}

module.exports = { beijingDate, groupBookings };
