export interface ActionDispatchedPayload {
    actionType: string,
    previousState: Record<string, any>,
    action: Record<string, any>,
    nextState: Record<string, any>,
}