/**
 * A platform-independent EventEmitter implementation
 * that works on all platforms including mobile.
 */
export class EventEmitter {
    private events: Record<string, Function[]> = {};

    /**
     * Register an event listener
     * @param event The event name
     * @param listener The callback function
     */
    on(event: string, listener: Function): this {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }

    /**
     * Register a one-time event listener
     * @param event The event name
     * @param listener The callback function
     */
    once(event: string, listener: Function): this {
        const onceWrapper = (...args: any[]) => {
            listener(...args);
            this.removeListener(event, onceWrapper);
        };
        return this.on(event, onceWrapper);
    }

    /**
     * Emit an event
     * @param event The event name
     * @param args Arguments to pass to listeners
     */
    emit(event: string, ...args: any[]): boolean {
        if (!this.events[event]) {
            return false;
        }
        this.events[event].forEach(listener => listener(...args));
        return true;
    }

    /**
     * Remove a specific listener
     * @param event The event name
     * @param listener The listener to remove
     */
    removeListener(event: string, listener: Function): this {
        if (!this.events[event]) {
            return this;
        }
        this.events[event] = this.events[event].filter(l => l !== listener);
        return this;
    }

    /**
     * Remove all listeners
     * @param event Optional event name. If not provided, removes all listeners for all events
     */
    removeAllListeners(event?: string): this {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
        return this;
    }
} 