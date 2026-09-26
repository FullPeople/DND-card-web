import {defineConfig} from '@playwright/test';
import base from './playwright.feedback-wiki.config';
export default defineConfig({...base,testMatch:'equipment-loading-feedback.spec.ts',timeout:120000,outputDir:'test-results-equipment-feedback'});
