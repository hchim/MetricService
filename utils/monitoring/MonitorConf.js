module.exports = {
    Redlock_TTL: 30000,
    Redlock_ID: 'MetricService:MonitorTaskQueue',
    Consumer: {
        Execute_interval: 60000,
        Tasks_per_req: 2
    },
    Recoverer: {
        Execute_interval: 300000,
        Tasks_per_req: 5,
        Task_ttl: 600000
    }
}
