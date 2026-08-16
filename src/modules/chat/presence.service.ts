import { Injectable } from '@nestjs/common';

// Tracks which employees currently have at least one open chat socket.
// In-memory by design: presence is only meaningful for the currently
// running server process (single instance), not a persisted fact.
@Injectable()
export class PresenceService {
  private onlineSockets = new Map<string, Set<string>>();

  // Returns true if this is the employee's first connection (i.e. they just came online).
  addConnection(employeeId: string, socketId: string): boolean {
    const existing = this.onlineSockets.get(employeeId);
    if (existing) {
      existing.add(socketId);
      return false;
    }
    this.onlineSockets.set(employeeId, new Set([socketId]));
    return true;
  }

  // Returns true if this was the employee's last connection (i.e. they just went offline).
  removeConnection(employeeId: string, socketId: string): boolean {
    const existing = this.onlineSockets.get(employeeId);
    if (!existing) return false;

    existing.delete(socketId);
    if (existing.size === 0) {
      this.onlineSockets.delete(employeeId);
      return true;
    }
    return false;
  }

  isOnline(employeeId: string): boolean {
    return this.onlineSockets.has(employeeId);
  }

  getOnlineEmployeeIds(): string[] {
    return Array.from(this.onlineSockets.keys());
  }
}
