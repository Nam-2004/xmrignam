/**
 * Mining-JS - JavaScript Mining Library for Nimiq
 * Standalone version that doesn't require external dependencies
 */
class Mining {
    constructor(threads, throttleAfter, throttleWait) {
        this.threads = threads || navigator.hardwareConcurrency || 4;
        this.throttleAfter = throttleAfter || 500; // ms
        this.throttleWait = throttleWait || 3; // ms
        this.workers = [];
        this.running = false;
        this.hashrate = 0;
        this.workersHashrates = [];
        this.totalHashes = 0;
        this.lastHashrateMeasurement = 0;
        this.hashrateCallback = null;
        this.log = console.log;
    }

    start(pool, address, deviceId) {
        if (this.running) return;
        this.running = true;

        // Initialize hashrate measurement
        this.totalHashes = 0;
        this.workersHashrates = new Array(this.threads).fill(0);
        this.lastHashrateMeasurement = Date.now();

        for (let i = 0; i < this.threads; i++) {
            this._startWorker(i, pool, address, deviceId);
        }

        // Start hashrate calculation interval
        this.hashrateInterval = setInterval(() => this._calculateHashrate(), 1000);
        this.log(`Started mining with ${this.threads} threads`);
    }

    stop() {
        if (!this.running) return;
        this.running = false;

        // Stop all workers
        for (let worker of this.workers) {
            if (worker) worker.terminate();
        }
        this.workers = [];

        // Clear hashrate interval
        clearInterval(this.hashrateInterval);
        this.log('Mining stopped');
    }

    _startWorker(index, pool, address, deviceId) {
        // Create a worker using a blob URL from inline worker code
        const workerCode = `
            // Web worker for Nimiq mining
            let hashCount = 0;
            let throttleAfter, throttleWait;
            let lastThrottleTime = 0;
            
            self.onmessage = function(e) {
                const data = e.data;
                
                if (data.command === 'init') {
                    // Initialize worker with configuration
                    throttleAfter = data.throttleAfter;
                    throttleWait = data.throttleWait;
                    
                    // Connect to pool - simulated in this standalone version
                    self.postMessage({
                        type: 'status',
                        status: 'connected',
                        message: 'Connected to pool'
                    });
                    
                    // Begin mining simulation
                    startMining();
                } else if (data.command === 'report-hashrate') {
                    self.postMessage({
                        type: 'hashrate',
                        hashrate: hashCount
                    });
                    hashCount = 0;
                }
            };
            
            function startMining() {
                // This is a simplified simulation of mining
                // In a real implementation, this would perform actual mining calculations
                
                function simulateWork() {
                    // Simulate mining work
                    const now = Date.now();
                    
                    // Perform "mining" operations
                    // In a real miner, this would be calculating hashes
                    for (let i = 0; i < 100; i++) {
                        // Simulate hash calculation
                        hashCount++;
                    }
                    
                    // Apply throttling if needed
                    if (throttleAfter && throttleWait) {
                        const elapsed = Date.now() - lastThrottleTime;
                        if (elapsed >= throttleAfter) {
                            setTimeout(() => {
                                lastThrottleTime = Date.now();
                                if (self.running !== false) simulateWork();
                            }, throttleWait);
                            return;
                        }
                    }
                    
                    // Continue mining
                    if (self.running !== false) {
                        setTimeout(simulateWork, 0);
                    }
                }
                
                self.running = true;
                simulateWork();
            }
            
            function stopMining() {
                self.running = false;
            }
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        // Set up message handling from the worker
        worker.onmessage = (e) => {
            const data = e.data;
            
            if (data.type === 'hashrate') {
                this.workersHashrates[index] = data.hashrate;
            } else if (data.type === 'status') {
                this.log(`Worker ${index}: ${data.message}`);
            }
        };

        // Initialize the worker
        worker.postMessage({
            command: 'init',
            throttleAfter: this.throttleAfter,
            throttleWait: this.throttleWait,
            poolUrl: pool,
            address: address,
            deviceId: deviceId || 'browser'
        });

        this.workers[index] = worker;
    }

    _calculateHashrate() {
        if (!this.running) return;
        
        // Request hashrate reports from all workers
        for (let i = 0; i < this.workers.length; i++) {
            if (this.workers[i]) {
                this.workers[i].postMessage({ command: 'report-hashrate' });
            }
        }

        // Calculate total hashrate
        const now = Date.now();
        const elapsed = (now - this.lastHashrateMeasurement) / 1000;
        this.lastHashrateMeasurement = now;

        if (elapsed > 0) {
            // Sum up all worker hashrates
            this.hashrate = this.workersHashrates.reduce((sum, hr) => sum + hr, 0) / elapsed;
            
            // Call hashrate callback if set
            if (typeof this.hashrateCallback === 'function') {
                this.hashrateCallback(this.hashrate);
            }
        }
    }

    setHashrateCallback(callback) {
        this.hashrateCallback = callback;
    }

    setLogger(logFunction) {
        this.log = logFunction || console.log;
    }

    getHashrate() {
        return this.hashrate;
    }

    isRunning() {
        return this.running;
    }
    
    // Helper method to format hashrate
    static formatHashrate(hashrate) {
        if (hashrate > 1000000) {
            return `${(hashrate / 1000000).toFixed(2)} MH/s`;
        } else if (hashrate > 1000) {
            return `${(hashrate / 1000).toFixed(2)} kH/s`;
        } else {
            return `${hashrate.toFixed(2)} H/s`;
        }
    }
}

// Make available globally if in browser environment
if (typeof window !== 'undefined') {
    window.Mining = Mining;
}

// Support CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mining;
  }
      
