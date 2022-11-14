import { State, Action, AnyModel, ModelOptions } from './modelOptions'
import {
  createModelInstnace,
  ModelInternal,
  Store,
  SubscriptionCallback,
  UnSubscribe,
} from './model'
import { ModelPublicInstance } from './modelPublicInstance'
import { queueJob, SchedulerJob } from './scheduler'
import { emptyObject } from '../utils'

export type ModelManagerOptions = {
  initialState?: Record<string, any>
  plugins?: [Plugin, any?][]
}

export const proxyMethods = [
  'name',
  'getState',
  'dispatch',
  'subscribe',
  'reducer',
  'replace',
] as const

export type ProxyMethods = typeof proxyMethods[number]

type InternalModelProxy = Pick<ModelInternal<AnyModel>, ProxyMethods>

export interface ModelManager extends Omit<Store, 'subscribe'> {
  getModel<IModel extends ModelOptions<any, any, any, any, any>>(
    model: IModel
  ): ModelPublicInstance<IModel>
  subscribe(fn: SubscriptionCallback): UnSubscribe
  subscribe(model: AnyModel, fn: SubscriptionCallback): UnSubscribe
}

export type PluginHook<IModel extends AnyModel = AnyModel> = {
  onInit?(store: ModelManager, initialState: Record<string, State>): void
  onModel?(model: IModel): void
  onModelInstance?(instance: InternalModelProxy): void
  onDestroy?(): void
}

export type Plugin<IModel extends AnyModel = AnyModel, Option = any> = (
  option: Option
) => PluginHook<IModel>

interface MapHelper {
  get(key: AnyModel): ModelInternal | undefined
  set(key: AnyModel, model: ModelInternal): void
  each(fn: (item: ModelInternal) => void): void
  clear(): void
}

const createMapHelper = (): MapHelper => {
  const models = new Map<string, ModelInternal>()

  const self: MapHelper = {
    get(modelOptions: AnyModel) {
      return models.get(modelOptions.name || modelOptions)
    },
    set(modelOptions: AnyModel, model: ModelInternal) {
      models.set(modelOptions.name || modelOptions, model)
    },
    each(fn) {
      for (const model of models.values()) {
        fn(model)
      }
    },
    clear() {
      self.each((m) => m.destroy())
      models.clear()
    },
  }

  return self
}

class ModelManagerImpl implements ModelManager {
  private _initialState: Record<string, State>
  private _hooks: PluginHook[]
  private _models: MapHelper
  private _subscribers: Set<SubscriptionCallback> = new Set()
  private _onModelChange: SubscriptionCallback

  constructor(initialState = emptyObject, plugins: [Plugin, any?][] = []) {
    this._initialState = initialState
    this._models = createMapHelper()
    const emitChange: SchedulerJob = () => {
      for (const listener of this._subscribers) {
        listener()
      }
    }
    this._onModelChange = () => {
      queueJob(emitChange)
    }
    this._hooks = plugins.map(([plugin, option]) => plugin(option))
    this._hooks.map((hook) => hook.onInit?.(this, initialState))
  }

  getModel<IModel extends AnyModel>(model: IModel) {
    let instance = this._getModelInstance(model)
    return instance.proxy as ModelPublicInstance<IModel>
  }

  getState() {
    const allState = {} as ReturnType<ModelManager['getState']>
    const anonymousState: any[] = []
    this._models.each((m) => {
      if (m.name) {
        allState[m.name] = m.getState()
      } else {
        anonymousState.push(m.getState())
      }
    })

    if (anonymousState.length) {
      allState['_'] = anonymousState
    }

    return allState
  }

  dispatch(action: Action) {
    this._models.each((m) => {
      m.dispatch(action)
    })
    return action
  }

  subscribe(fn: SubscriptionCallback): UnSubscribe
  subscribe(model: AnyModel, fn: SubscriptionCallback): UnSubscribe
  subscribe(modelOrFn: any, fn?: any): any {
    if (typeof modelOrFn === 'function') {
      const listener: SubscriptionCallback = modelOrFn
      this._subscribers.add(listener)
      return () => {
        this._subscribers.delete(listener)
      }
    } else if (typeof fn === 'function') {
      const model: AnyModel = modelOrFn
      const instance = this._getModelInstance(model)
      return instance.subscribe(fn)
    }
  }

  destroy() {
    this._hooks.map((hook) => hook.onDestroy?.())
    this._models.clear()
    this._subscribers.clear()
    this._initialState = emptyObject
  }

  private _getModelInstance(model: AnyModel) {
    let cacheStore = this._models.get(model)
    if (cacheStore) {
      return cacheStore
    }

    return this._initModel(model)
  }

  private _initModel(model: AnyModel): ModelInternal {
    this._hooks.map((hook) => hook.onModel?.(model))

    const modelInstance = createModelInstnace(
      model,
      this._getInitialState(model.name)
    )
    modelInstance.subscribe(this._onModelChange)

    const depends = model._depends
    if (depends) {
      for (const [name, dep] of Object.entries(depends)) {
        // todo: lazy init
        const depInstance = this._getModelInstance(dep)
        modelInstance.depend(name, depInstance)
      }
    }

    const modelInstanceProxy = new Proxy(modelInstance, {
      get(target, prop: ProxyMethods, receiver: object) {
        if (proxyMethods.includes(prop)) {
          const value = Reflect.get(target, prop, receiver)
          if (typeof value === 'function') {
            return value.bind(target)
          } else {
            return value
          }
        }

        return undefined
      },
    })
    this._hooks.map((hook) => {
      hook.onModelInstance?.(modelInstanceProxy)
    })

    this._models.set(model, modelInstance)
    return modelInstance
  }

  private _getInitialState(name: string): State | undefined {
    const result = this._initialState[name]
    if (result) {
      delete this._initialState[name]
    }
    return result
  }
}

export function modelManager({
  initialState,
  plugins,
}: ModelManagerOptions = {}): ModelManager {
  return new ModelManagerImpl(initialState, plugins)
}
