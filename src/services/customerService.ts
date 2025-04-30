import supabase from '@/lib/supabase';
import { Customer } from '@/types';

// Helper function to convert database customer to our Customer type
const mapDatabaseCustomerToCustomer = (dbCustomer: any): Customer => {
  return {
    id: dbCustomer.id,
    name: dbCustomer.name,
    email: dbCustomer.email || undefined,
    phone: dbCustomer.phone || undefined,
    mobile: dbCustomer.mobile || undefined,
    company: dbCustomer.company || undefined,
    assignedUserId: dbCustomer.assigned_user_id || undefined,
    status: dbCustomer.status,
    notes: dbCustomer.notes || undefined,
    createdAt: dbCustomer.created_at,
    updatedAt: dbCustomer.updated_at,
    metadata: dbCustomer.metadata || {},
    lastContactDate: dbCustomer.last_contact_date || undefined,
    classification: dbCustomer.classification || "standard",
    acquisitionSource: dbCustomer.acquisition_source || undefined,
    acquisitionDate: dbCustomer.acquisition_date || undefined,
    lifetimeValue: dbCustomer.lifetime_value || 0,
  };
};

interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'lead' | 'customer' | 'inactive';
  classification?: 'vip' | 'standard' | 'inactive';
  assignedUserId?: string;
  tag?: string;
}

interface GetCustomersResponse {
  customers: Customer[];
  total: number;
}

class CustomerService {
  async getCustomers(params: GetCustomersParams = {}): Promise<GetCustomersResponse> {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        status,
        classification,
        assignedUserId,
        tag,
      } = params;

      // Calculate pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Start building the query
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      // Apply filters if they exist
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (classification) {
        query = query.eq('classification', classification);
      }

      if (assignedUserId) {
        query = query.eq('assigned_user_id', assignedUserId);
      }

      // Execute the query
      const { data: customers, error, count } = await query;

      if (error) throw error;

      // If we're filtering by tag, we need to do a separate query
      let filteredCustomers = customers;
      
      if (tag) {
        const { data: taggedCustomerIds, error: tagError } = await supabase
          .from('customer_tags')
          .select('customer_id')
          .eq('tag', tag);
          
        if (tagError) throw tagError;
        
        const taggedIds = taggedCustomerIds.map(item => item.customer_id);
        filteredCustomers = customers.filter(customer => taggedIds.includes(customer.id));
      }

      // Map database customers to our Customer type
      const mappedCustomers = filteredCustomers.map(mapDatabaseCustomerToCustomer);

      return {
        customers: mappedCustomers,
        total: count || mappedCustomers.length,
      };
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  }

  async getCustomerById(id: string): Promise<Customer> {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!customer) throw new Error('Müşteri bulunamadı.');
      
      return mapDatabaseCustomerToCustomer(customer);
    } catch (error) {
      console.error('Error fetching customer by ID:', error);
      throw error;
    }
  }

  async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    try {
      // Prepare data for insert
      const insertData: Record<string, any> = {
        name: customerData.name,
      };

      // Add optional fields if they exist
      if (customerData.email) insertData.email = customerData.email;
      if (customerData.phone) insertData.phone = customerData.phone;
      if (customerData.mobile) insertData.mobile = customerData.mobile;
      if (customerData.company) insertData.company = customerData.company;
      if (customerData.assignedUserId) insertData.assigned_user_id = customerData.assignedUserId;
      if (customerData.status) insertData.status = customerData.status;
      if (customerData.notes) insertData.notes = customerData.notes;
      if (customerData.classification) insertData.classification = customerData.classification;
      if (customerData.acquisitionSource) insertData.acquisition_source = customerData.acquisitionSource;
      if (customerData.acquisitionDate) insertData.acquisition_date = customerData.acquisitionDate;
      if (customerData.lifetimeValue) insertData.lifetime_value = customerData.lifetimeValue;
      
      // Automatically set acquisition date to now if not provided
      if (!insertData.acquisition_date && insertData.status === 'lead') {
        insertData.acquisition_date = new Date().toISOString();
      }

      const { data: customer, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      return mapDatabaseCustomerToCustomer(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<Customer> {
    try {
      // Prepare data for update
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Add fields that are being updated
      if (customerData.name !== undefined) updateData.name = customerData.name;
      if (customerData.email !== undefined) updateData.email = customerData.email;
      if (customerData.phone !== undefined) updateData.phone = customerData.phone;
      if (customerData.mobile !== undefined) updateData.mobile = customerData.mobile;
      if (customerData.company !== undefined) updateData.company = customerData.company;
      if (customerData.assignedUserId !== undefined) updateData.assigned_user_id = customerData.assignedUserId;
      if (customerData.status !== undefined) updateData.status = customerData.status;
      if (customerData.notes !== undefined) updateData.notes = customerData.notes;
      if (customerData.classification !== undefined) updateData.classification = customerData.classification;
      if (customerData.acquisitionSource !== undefined) updateData.acquisition_source = customerData.acquisitionSource;
      if (customerData.acquisitionDate !== undefined) updateData.acquisition_date = customerData.acquisitionDate;
      if (customerData.lifetimeValue !== undefined) updateData.lifetime_value = customerData.lifetimeValue;
      
      // If status is changed to 'customer' from 'lead', update last_contact_date
      if (customerData.status === 'customer') {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('status')
          .eq('id', id)
          .single();
          
        if (existingCustomer && existingCustomer.status === 'lead') {
          updateData.last_contact_date = new Date().toISOString();
        }
      }

      const { data: customer, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      return mapDatabaseCustomerToCustomer(customer);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%,phone.ilike.%${query}%,mobile.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      
      return customers.map(mapDatabaseCustomerToCustomer);
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  async updateCustomerStatus(
    id: string, 
    status: 'lead' | 'customer' | 'inactive'
  ): Promise<Customer> {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          last_contact_date: status === 'customer' ? new Date().toISOString() : undefined
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      return mapDatabaseCustomerToCustomer(customer);
    } catch (error) {
      console.error('Error updating customer status:', error);
      throw error;
    }
  }

  async assignCustomer(id: string, userId: string): Promise<Customer> {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .update({ 
          assigned_user_id: userId, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      return mapDatabaseCustomerToCustomer(customer);
    } catch (error) {
      console.error('Error assigning customer:', error);
      throw error;
    }
  }

  async addTagToCustomer(customerId: string, tag: string): Promise<void> {
    try {
      // Normalize tag (lowercase, trim)
      const normalizedTag = tag.toLowerCase().trim();
      
      const { error } = await supabase
        .from('customer_tags')
        .insert({ 
          customer_id: customerId, 
          tag: normalizedTag,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) {
        // If tag already exists, ignore the error
        if (!error.message.includes('duplicate key')) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error adding tag to customer:', error);
      throw error;
    }
  }

  async removeTagFromCustomer(customerId: string, tag: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customer_tags')
        .delete()
        .eq('customer_id', customerId)
        .eq('tag', tag);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing tag from customer:', error);
      throw error;
    }
  }

  async getCustomerTags(customerId: string): Promise<string[]> {
    try {
      const { data: tags, error } = await supabase
        .from('customer_tags')
        .select('tag')
        .eq('customer_id', customerId);

      if (error) throw error;
      
      return tags.map(t => t.tag);
    } catch (error) {
      console.error('Error getting customer tags:', error);
      throw error;
    }
  }

  async getAllTags(): Promise<string[]> {
    try {
      const { data: tags, error } = await supabase
        .from('customer_tags')
        .select('tag')
        .order('tag');

      if (error) throw error;
      
      // Create unique set of tags
      const uniqueTags = new Set(tags.map(t => t.tag));
      
      return Array.from(uniqueTags);
    } catch (error) {
      console.error('Error getting all tags:', error);
      throw error;
    }
  }
}

export default new CustomerService();