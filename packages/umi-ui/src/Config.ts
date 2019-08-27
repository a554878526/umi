import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { get } from 'lodash';
import { basename, dirname, join } from 'path';
import userHome from 'user-home';
import mkdirp from 'mkdirp';
import assert from 'assert';

let count = 0;

interface IOpts {
  dbPath?: string;
  onSave?: any;
}

export interface ICreateProgress {
  step: number;
  stepStatus: number;
  steps: string[];
  success?: boolean;
  failure?: Error;
}

export interface IProjectItem {
  name: string;
  path: string;
  creatingProgress?: ICreateProgress;
  created_at?: number;
  npmClient?: string;
  taobaoSpeedUp?: boolean;
}

interface IProjectsByKey {
  [key: string]: IProjectItem;
}

export default class Config {
  dbPath: string;

  data: {
    projectsByKey?: IProjectsByKey;
    currentProject?: string;
  };

  onSave: any;

  constructor(opts: IOpts = {}) {
    const { dbPath, onSave } = opts;
    this.dbPath = dbPath || join(userHome, '.umi/ui/data.json');
    this.onSave = onSave;
    mkdirp.sync(dirname(this.dbPath));
    this.load();
  }

  load() {
    if (existsSync(this.dbPath)) {
      this.data = JSON.parse(readFileSync(this.dbPath, 'utf-8'));
    } else {
      this.data = {};
    }

    if (!this.data.projectsByKey) {
      this.data.projectsByKey = {};
    }
  }

  save() {
    writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    if (this.onSave) this.onSave(this.data);
  }

  addProject({
    name,
    path,
    npmClient,
    taobaoSpeedUp,
  }: {
    path: string;
    name: string;
    npmClient?: string;
    taobaoSpeedUp?: boolean;
  }): string {
    name = name || basename(path);
    const str = `${path}____${name}`;
    const key = createHash('md5')
      .update(str)
      .digest('hex')
      .slice(0, 6);
    if (!this.data.projectsByKey[key]) {
      this.data.projectsByKey[key] = {
        path,
        name,
        created_at: +new Date(),
        npmClient,
        taobaoSpeedUp,
      };
      this.save();
    }
    return key;
  }

  deleteProject(key) {
    delete this.data.projectsByKey[key];
    if (this.data.currentProject === key) {
      delete this.data.currentProject;
    }
    this.save();
  }

  editProject(key, newProps: Object) {
    this.data.projectsByKey[key] = {
      ...this.data.projectsByKey[key],
      ...newProps,
    };
    this.save();
  }

  setCreatingProgress(key, args) {
    // KEY
    // step: 1,
    // stepStatus: 'loading',
    // steps: [''],
    this.data.projectsByKey[key].creatingProgress = {
      ...this.data.projectsByKey[key].creatingProgress,
      ...args,
    };
    this.save();
  }

  setCreatingProgressDone(key) {
    delete this.data.projectsByKey[key].creatingProgress;
    this.save();
  }

  setCurrentProject(key) {
    assert(this.data.projectsByKey[key], `project of key ${key} not found`);
    assert(
      get(this.data, `projectsByKey.${key}.creatingProgress.success`) ||
        !get(this.data, `projectsByKey.${key}.creatingProgress`),
      `project of key ${key} is still creating`,
    );
    this.data.currentProject = key;
    this.save();
  }

  setProjectNpmClient({ npmClient, key }: { npmClient: string; key: string }) {
    this.data.projectsByKey[key].npmClient = npmClient;
    this.save();
  }

  addProjectAndSetCurrent(projectPath: string) {
    const absProjectPath = join(process.cwd(), projectPath);
    const pathArray = absProjectPath.split('/');
    const projectName = pathArray[pathArray.length - 1];
    const key = this.addProject({ name: projectName, path: absProjectPath });
    this.setCurrentProject(key);
  }
}