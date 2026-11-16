// Loaded automatically by the Create React App dev server (react-scripts start).
// Adds custom Express routes on top of the dev server.

module.exports = function (app) {
  // GET /exit -> simulates a server crash by terminating the Node process.
  // The response is never sent, so the client sees a dropped connection.
  // Exit code 1 mirrors a crash (non-zero), so Docker / Kubernetes treat it as a failure.
  app.get('/exit', (req, res) => {
    console.error(`[${new Date().toISOString()}] /exit called - simulating server crash`);
    process.exit(1);
  });
};
