const redisConfig = {
    processingQueueName: "file_processing_queue",
    fallbackQueueName: "dead_letter_queue"
}

const MAX_RETRIES = 2;

export {redisConfig, MAX_RETRIES}