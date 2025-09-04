/**
 * 共享的草稿存储模块
 * 确保所有API路由使用同一个存储实例
 */

import { promises as fs } from 'fs';
import path from 'path';

const draftsDir = path.join(process.cwd(), '.next', 'drafts');
const draftsFile = path.join(draftsDir, 'drafts.json');

// 单例存储实例
class DraftsStorage {
  private drafts: Map<string, any> = new Map();
  private initialized = false;
  private loadPromise: Promise<void> | null = null;
  private savePromise: Promise<void> | null = null;

  async ensureDir() {
    try {
      await fs.mkdir(draftsDir, { recursive: true });
    } catch (error) {
      // Directory already exists, ignore error
    }
  }

  async loadDrafts() {
    // 防止并发加载，使用Promise缓存
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }
    
    if (this.initialized) return;
    
    this.loadPromise = this._loadDraftsInternal();
    await this.loadPromise;
    this.loadPromise = null;
  }
  
  private async _loadDraftsInternal() {
    try {
      await this.ensureDir();
      const data = await fs.readFile(draftsFile, 'utf8');
      const parsed = JSON.parse(data);
      
      this.drafts.clear();
      for (const [key, value] of Object.entries(parsed)) {
        this.drafts.set(key, value);
      }
      
      console.log(`📂 Loaded ${this.drafts.size} drafts from persistent storage`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to load drafts from file:', error.message);
      }
      // File doesn't exist or is corrupted, start with empty storage
    }
    
    this.initialized = true;
  }

  async saveDrafts() {
    // 防止并发保存，使用Promise缓存
    if (this.savePromise) {
      await this.savePromise;
      return;
    }
    
    this.savePromise = this._saveDraftsInternal();
    await this.savePromise;
    this.savePromise = null;
  }
  
  private async _saveDraftsInternal() {
    try {
      await this.ensureDir();
      const data = Object.fromEntries(this.drafts);
      await fs.writeFile(draftsFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.drafts.size} drafts to persistent storage`);
    } catch (error) {
      console.warn('Failed to save drafts to file:', error.message);
    }
  }

  async get(draftId: string) {
    // 等待任何正在进行的保存操作完成，然后重新加载
    if (this.savePromise) {
      await this.savePromise;
    }
    this.initialized = false;
    await this.loadDrafts();
    return this.drafts.get(draftId);
  }

  async set(draftId: string, draft: any) {
    // 等待任何正在进行的操作完成，然后重新加载、设置并保存
    if (this.savePromise) {
      await this.savePromise;
    }
    this.initialized = false;
    await this.loadDrafts();
    this.drafts.set(draftId, draft);
    await this.saveDrafts();
  }

  async delete(draftId: string) {
    this.initialized = false;
    await this.loadDrafts();
    const deleted = this.drafts.delete(draftId);
    if (deleted) {
      await this.saveDrafts();
    }
    return deleted;
  }

  async getAll() {
    this.initialized = false;
    await this.loadDrafts();
    return Array.from(this.drafts.entries()).map(([id, draft]) => ({
      id,
      ...draft
    }));
  }

  async size() {
    this.initialized = false;
    await this.loadDrafts();
    return this.drafts.size;
  }
}

// 导出单例实例
export const draftsStorage = new DraftsStorage();