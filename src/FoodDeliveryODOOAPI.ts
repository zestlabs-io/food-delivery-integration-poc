import got from 'got';
const url = require('url');

export class FoodDeliveryODOOAPI {
  protected _baseURL: string;
  protected _username: string;
  protected _password: string;

  private _token: string;

  constructor(baseURL: string, username: string, password: string) {
    this._baseURL = baseURL;
    this._username = username;
    this._password = password;
    this._token = '';
  }

  public async doLogin() {
    console.log('Login with username: ', this._username, '/', this._password)
    try {
      const resp = await got.get(`${this._baseURL}/jwt/auth`, {
        headers: {
          user: this._username,
          pass: this._password
        }
      });
      if (resp.statusCode < 300) {
        this._token = JSON.parse(resp.body).token;
      } else {
        throw Error('Failed to fetch token: ' + resp.statusCode);
      }
    } catch (err) {
      throw err;
    }
  }

  public getToken() {
    return this._token
  }

  protected getOpts() {
    return {
      headers: {
        'Authorization': 'Bearer ' + this._token,
        'Content-Type': 'application/json'
      }
    };
  }

  public async getTransports(date: string, limit = 100, offset = 0, count = 0): Promise<ODOJSONRPCResult<Array<Transport>>> {
    const url = `${this._baseURL}/api/picking.transport.info/`
    const params = {
      limit: limit,
      offset: offset,
      count: count,
      args: `[('transport_date', 'like', '${date}%')]`,
      fields: "['id', 'name', ('transporter_id', ['id', 'name']), ('delivery_id', ['id', 'name'] ), 'display_name', 'name', 'state', 'transport_date', ]"
    }
    const reqObject = {}
    const headers = this.getOpts().headers
    try {
      const resp = await got.get(url, { headers: headers, json: reqObject, allowGetBody: true, searchParams: params });
      return JSON.parse(resp.body) as ODOJSONRPCResult<Array<Transport>>;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  public async getPartner(id: string): Promise<ODOJSONRPCResult<Partner>> {
    const url = `${this._baseURL}/api/res.partner/`
    const params = {
      args: `[("id", "=", ${id}) ]`,
      fields: "['id', 'name', 'contact_address', 'mobile', ]"
    }
    const headers = this.getOpts().headers
    try {
      const resp = await got.get(url, { headers: headers, json: params, allowGetBody: true, searchParams: params });
      return JSON.parse(resp.body) as ODOJSONRPCResult<Partner>;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  public async getDeliveryDetails(id: string): Promise<ODOJSONRPCResult<Delivery[]>> {
    const url = `${this._baseURL}/api/stock.picking/`
    const reqObject = {
      args: `[("id", "=", ${id}) ]`,
      fields: "['id', 'name', 'partner_id', ('partner_id', ['id', 'name', 'contact_address', 'mobile']), 'scheduled_date', 'move_lines', 'move_line_ids_without_package', ]"
    }
    const headers = this.getOpts().headers
    try {
      const resp = await got.get(url, { headers: headers, json: reqObject, allowGetBody: true, searchParams: reqObject });
      return JSON.parse(resp.body) as ODOJSONRPCResult<Delivery[]>;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  public async getDeliveryLines(id: string[]): Promise<ODOJSONRPCResult<DeliveryLine[]>> {
    const url = `${this._baseURL}/api/stock.move.line/`
    const ids = id.join(",")
    const reqObject = {
      args: `[("id", "in", (${ids}))]`,
      fields: "['product_id', ('product_id', ['id', 'name']), 'qty_done', ]"
    }
    const headers = this.getOpts().headers
    try {
      const resp = await got.get(url, { headers: headers, json: reqObject, allowGetBody: true, searchParams: reqObject });
      return JSON.parse(resp.body) as ODOJSONRPCResult<DeliveryLine[]>;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}

export interface ODOJSONRPCResult<T> {
  result: ODOResult<T>
}

export interface ODOResult<T> {
  status_code: string
  data: T
}

export interface Transport {
  id: string
  name: string
  transport_data: string
  state: string
  display_name: string
  transporter_id: Transporter
  delivery_id: Delivery
}

export interface Transporter {
  id: string
  name: string
}

export interface Partner {
  id: string
  name: string
  contact_address: string
  mobile: string | boolean
}

export interface Delivery {
  id: string
  name: string
  partner_id: Partner
  scheduled_data: string
  move_lines: string
  move_line_ids_without_package: string
}

export interface DeliveryLine {
  product_id: Product
  qty_done: number
}

export interface Product {
  id: number
  name: string
}