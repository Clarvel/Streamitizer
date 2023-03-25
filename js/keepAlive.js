// Self-contained workaround for crbug.com/1316588 (Apache License)
let lastAlarm = 0;
(async function lostEventsWatchdog() {
  let quietCount = 0;
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 65000));
    const now = Date.now();
    const age = now - lastAlarm;
    console.log(`lostEventsWatchdog: last alarm ${age/1000}s ago`);
    if (age < 95000) {
      quietCount = 0;  // alarm still works.
    } else if (++quietCount >= 3) {
      console.error("lostEventsWatchdog: reloading!");
      return chrome.runtime.reload();
    } else {
      chrome.alarms.create(`lostEventsWatchdog/${now}`, {delayInMinutes: 1});
    }
  }
})();
// Requires the "alarms" permission:
chrome.alarms.onAlarm.addListener(() => lastAlarm = Date.now());