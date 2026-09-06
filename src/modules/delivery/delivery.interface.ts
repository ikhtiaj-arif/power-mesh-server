export interface IGetDeliveryParams {
  reservationId: string;
}

export interface IProviderCheckInParams {
  reservationId: string;
}

export interface IProviderReportParams {
  reservationId: string;
}

export interface IProviderReportPayload {
  actualDeliveredKw: number;
}

export interface IConsumerConfirmParams {
  reservationId: string;
}

export interface IConsumerDisputeParams {
  reservationId: string;
}

export interface IConsumerDisputePayload {
  disputeReason: string;
}
