import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BootEvents } from './shared/events/local.events';

@Injectable()
export class BootService {
  constructor(private boot_events: EventEmitter2) {}
  exe_health_talk(): string {
    return '🤍🔥✨ Thumbs up Cliq Mit! ✨🔥🤍';
  }

  @OnEvent(BootEvents.INIT_APP)
  async boot() {
    void (await this.boot_events.eventNames());
  }
}
