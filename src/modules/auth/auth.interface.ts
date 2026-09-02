export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterConsumerPayload {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	consumer: {
		contactPhone?: string;
	};
}