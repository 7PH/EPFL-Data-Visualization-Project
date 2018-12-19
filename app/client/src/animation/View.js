import {Stage} from "./Stage";
import {rangeControl} from "../util/range";
import * as EventEmitter from "events";


/**
 *
 * @emits timeline_update When the timeline is updated
 */
export class View extends EventEmitter {

    constructor(model) {
        super();

        this.model = model;
        this.audio = document.getElementById(View.AMBIENT_AUDIO);
        this.audioButton = document.getElementById(View.AUDIO_BUTTON);
        this.timeline = document.getElementById(View.TIMELINE);
        this.timelineHud = document.getElementById(View.TIMELINE_HUD);
        this.timelineHudInfo = this.timelineHud.children[0];
        this.timelineHudLeft = this.timelineHud.children[1];
        this.timelineHudRight = this.timelineHud.children[2];
        this.timelineRange = document.getElementById(View.TIMELINE_RANGE_ID);
        this.autoplayButton = document.getElementById(View.AUTOPLAY_BUTTON);
        this.setTimeline = null;
        this.stage = new Stage();

        this.timelineHudLeft.innerHTML = this.dateToHtml(model.minDate, 2);
        this.timelineHudRight.innerHTML = this.dateToHtml(model.maxDate, 2);

        this.bind();
    }

    bind() {
        this.setTimeline = rangeControl(View.TIMELINE_RANGE_ID, v => this.emit('timeline_update', v));
        this.model.on('update', events => this.onUpdate(events));
        this.model.on('trigger', () => this.onTrigger())
    }

    /**
     *
     * @param events
     * @return {Promise<void>}
     */
    async onUpdate(events) {
        await this.stage.setEvents(events);
    }

    /**
     *
     * @return {Promise<void>}
     */
    async onTrigger() {
        this.timelineHudInfo.innerHTML = `
        ${this.dateToHtml(this.model.start, 3)}
         - ${this.dateToHtml(this.model.end, 3)}
        `;
    }

    /**
     *
     * @return {Promise<void>}
     */
    async start() {
        await this.stage.start();
    }

    /**
     *
     */
    playAudio() {
        this.audio.play();
    }

    /**
     *
     */
    stopAudio() {
        this.audio.pause();
    }

    /**
     *
     * @param {boolean} value
     */
    setAutoPlay(value) {
        this.autoplayButton.checked = !!value;
    }

    /**
     * @TODO document
     * @TODO move to Helpers?
     *
     * @param date
     * @param type
     * @return {string}
     */
    dateToHtml(date, type) {
        let Y = date.getFullYear();
        let M = date.getMonth() + 1;
        let D = date.getDate();
        let h = date.getHours();
        let m = date.getMinutes();
        switch (type || 1) {
            case 1:
                return `${M < 10 ? '0' : ''}${M}/${Y}`;
            case 2:
                return `${D < 10 ? '0' : ''}${D}/${M < 10 ? '0' : ''}${M}/${Y}`;
            case 3:
                return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m} ${D < 10 ? '0' : ''}${D}/${M < 10 ? '0' : ''}${M}/${Y}`;
            default:
                throw new Error("Unsupported date display type");
        }
    }
}

View.TIMELINE = 'timeline';
View.TIMELINE_HUD = 'timeline-hud';
View.TIMELINE_RANGE_ID = 'timeline-range';
View.AUTOPLAY_BUTTON = 'timeline-autoplay';
View.AUDIO_BUTTON = 'timeline-music';
View.AMBIENT_AUDIO = 'ambient-audio';
