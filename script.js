const statusValue = document.getElementById("status-value");
const statusDetail = document.getElementById("status-detail");
const statusNext = document.getElementById("status-next");
const statusUpdated = document.getElementById("status-updated");
const eventList = document.getElementById("event-list");

const PACIFIC_TZ = "America/Los_Angeles";

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const formatDuration = (ms) => {
  if (ms <= 0) {
    return "0 minutes";
  }

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }
  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }
  if (!days && !hours) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  } else if (minutes) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
};

const getPacificParts = (date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  return formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
};

const getTimeZoneOffset = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  const utcTime = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return utcTime - date.getTime();
};

const toPacificDate = (year, month, day, hour, minute) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const guessDate = new Date(utcGuess);
  let offset = getTimeZoneOffset(guessDate, PACIFIC_TZ);
  let adjusted = new Date(utcGuess - offset);
  const adjustedOffset = getTimeZoneOffset(adjusted, PACIFIC_TZ);

  if (adjustedOffset !== offset) {
    offset = adjustedOffset;
    adjusted = new Date(utcGuess - offset);
  }

  return adjusted;
};

const scheduleForDay = (weekday) => {
  switch (weekday) {
    case "Tue":
    case "Wed":
    case "Thu":
      return [
        { start: { hour: 18, minute: 0 }, end: { hour: 19, minute: 45 } },
      ];
    case "Fri":
      return [
        { start: { hour: 18, minute: 0 }, end: { hour: 19, minute: 45 } },
        { start: { hour: 19, minute: 45 }, end: { hour: 22, minute: 0 } },
      ];
    case "Sat":
      return [
        { start: { hour: 16, minute: 0 }, end: { hour: 18, minute: 0 } },
        { start: { hour: 20, minute: 0 }, end: { hour: 22, minute: 0 } },
      ];
    case "Sun":
      return [
        { start: { hour: 16, minute: 0 }, end: { hour: 18, minute: 0 } },
      ];
    default:
      return [];
  }
};

const buildUpcomingWindows = (now, count = 6) => {
  const windows = [];
  const startDate = new Date(now);

  for (let offset = 0; windows.length < count && offset < 21; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    const parts = getPacificParts(date);
    const sessions = scheduleForDay(parts.weekday);

    sessions.forEach((session) => {
      const start = toPacificDate(
        Number(parts.year),
        Number(parts.month),
        Number(parts.day),
        session.start.hour,
        session.start.minute
      );
      const end = toPacificDate(
        Number(parts.year),
        Number(parts.month),
        Number(parts.day),
        session.end.hour,
        session.end.minute
      );

      if (end > now) {
        windows.push({ start, end });
      }
    });
  }

  return windows.sort((a, b) => a.start - b.start).slice(0, count);
};

const renderUpcoming = (windows) => {
  eventList.innerHTML = "";

  if (!windows.length) {
    const empty = document.createElement("li");
    empty.className = "event-placeholder";
    empty.textContent = "No upcoming interdorm windows found.";
    eventList.appendChild(empty);
    return;
  }

  windows.forEach((window) => {
    const item = document.createElement("li");
    item.className = "event-item";

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = "Interdorm window";

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = `${formatDateTime(window.start)} – ${formatDateTime(
      window.end
    )}`;

    item.appendChild(title);
    item.appendChild(time);
    eventList.appendChild(item);
  });
};

const updateStatus = () => {
  const now = new Date();
  const windows = buildUpcomingWindows(now, 6);
  const current = windows.find(
    (window) => now >= window.start && now <= window.end
  );
  const next = windows.find((window) => window.start > now);

  if (current) {
    const remaining = current.end - now;
    statusValue.textContent = "Interdorm is ON";
    statusValue.classList.add("on");
    statusValue.classList.remove("off");
    statusDetail.textContent = `Ends in ${formatDuration(remaining)}.`;
    statusNext.textContent = `Ends: ${formatDateTime(current.end)}`;
  } else {
    statusValue.textContent = "Interdorm is OFF";
    statusValue.classList.add("off");
    statusValue.classList.remove("on");

    if (next) {
      const until = next.start - now;
      statusDetail.textContent = `Next session starts in ${formatDuration(until)}.`;
      statusNext.textContent = `Starts: ${formatDateTime(next.start)}`;
    } else {
      statusDetail.textContent = "No upcoming interdorm sessions are scheduled.";
      statusNext.textContent = "Next session: --";
    }
  }

  statusUpdated.textContent = `Updated: ${formatDateTime(now)}`;
  renderUpcoming(windows);
};

updateStatus();
setInterval(updateStatus, 60 * 1000);
