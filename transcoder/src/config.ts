const redisConfig = {
    processingQueueName: "file_processing_queue",
    fallbackQueueName: "dead_end_queue"
}

const MAX_RETRIES = 2;

export {redisConfig, MAX_RETRIES}