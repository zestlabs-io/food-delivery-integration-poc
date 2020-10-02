import { PoolDataServiceApiHMAC, DistrConfigServiceApiHMAC, AuthServiceApiHMAC, DataDocument } from '@zestlabs-io/zest-js-sdk';

const CustomersPool = 'fd_customers';
const OrdersPool = 'fd_orders';
const DeliveriesPool = 'fd_delivery';

export class FoodDeliveryZESTAPI {

  private _dataApi: PoolDataServiceApiHMAC
  private _distrApi: DistrConfigServiceApiHMAC
  private _authApi: AuthServiceApiHMAC

  constructor(baseUrl: string, cloudKey: string, cloudSecret: string) {
    this._dataApi = new PoolDataServiceApiHMAC(baseUrl, cloudKey, cloudSecret);
    this._distrApi = new DistrConfigServiceApiHMAC(baseUrl, cloudKey, cloudSecret);
    this._authApi = new AuthServiceApiHMAC(baseUrl, cloudKey, cloudSecret);
  }

  createCustomer = (customer: Customer[]): Promise<any> => {
    return this._dataApi.bulkCreate(CustomersPool, customer)
  }

  updateCustomer = (customer: Customer[]): Promise<any> => {
    return this._dataApi.bulkUpdate(CustomersPool, customer)
  }

  deleteCustomer = (id: string): Promise<any> => {
    return this._dataApi.bulkDelete(CustomersPool, [{ _id: id } as DataDocument]);
  }

  getCustomer = (id: string): Promise<any> => {
    return this._dataApi.get(CustomersPool, id)
  }

  createOrder = (order: Order[]): Promise<any> => {
    return this._dataApi.bulkCreate(OrdersPool, order)
  }

  updateOrder = (order: Order[]): Promise<any> => {
    return this._dataApi.bulkUpdate(OrdersPool, order)
  }

  deleteOrder = (id: string): Promise<any> => {
    return this._dataApi.bulkDelete(OrdersPool, [{ _id: id } as DataDocument]);
  }

  getOrder = (id: string): Promise<any> => {
    return this._dataApi.get(OrdersPool, id)
  }
}

export interface Customer {
  _id: string
  name: string
  address: string
  loc: GeoCoordinates | null
  phone: string | boolean
}

export interface GeoCoordinates {
  lat: number,
  long: number
}

export interface Order {
  _id: string
  routeId: string
  date: string
  customerId: string
  orderItems: OrderItem[] | null
  comment: string | null
}

export interface OrderItem {
  name: string
  qty: number
  comments: string | null
}

export interface Delivery {
  _id: string                    // customer._id + order._id,
  cashCollected: number | null   // parseFloat(this.cashCollected),
  customerId: string             // customer._id,
  deliveryDate: Date             // new Date().getTime(),
  orderId: string                // order._id,
  userId: string                 // this.props.userStore.user._id
}