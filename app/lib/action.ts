'use server';
import { z } from 'zod';
import { db } from './db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer.' }),
  amount: z.coerce //该 amount 字段专门设置为强制（更改）从字符串到数字，同时验证其类型。
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  date: z.string(),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

//prevState - 包含从 useFormState 钩子传递的状态。在此示例中，您不会在操作中使用它，但它是必需的道具
export async function createInvoice(_prevState: State, formData: FormData) {
  //   const rawFormData = Object.fromEntries(formData.entries());
  // console.log(rawFormData,"rawFormData")

  //safeParse()将返回一个包含成功或错误字段的对象。这将有助于更优雅地处理验证，而无需将此逻辑放入try/catch块中。

  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  //如果表单验证失败，尽早返回错误。否则,继续。
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  //准备插入数据库的数据
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  //注意如何在try/catch块之外调用redirect。这是因为重定向通过抛出错误来工作，而错误将被catch块捕获。为了避免这种情况，可以在try/catch之后调用redirect。只有在try成功时才能访问重定向。
  try {
    await db.$executeRaw`
    INSERT INTO invoices (id,customer_id, amount, status, date)
    VALUES (${uuidv4()},${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice',
    };
  }

  /***
   * Next.js有一个客户端路由器缓存，用于在用户的浏览器中存储一段时间的路由段。除了预取之外，此缓存还确保用户可以在路由之间快速导航，同时减少对服务器发出的请求数。
   * 由于您正在更新发票路由中显示的数据，因此您需要清除此缓存并触发对服务器的新请求
   * 更新数据库后，将重新验证 /dashboard/invoices 路径，并从服务器获取新数据。
   * 此时，您还需要将用户重定向回页面 /dashboard/invoices 。您可以使用Next.js中的 redirect 函数执行此操作
   */
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(
  id: string,
  _prevState: State,
  formData: FormData,
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice',
    };
  }

  const { amount, customerId, status } = validatedFields.data;
  const amountInCents = amount * 100;
  try {
    await db.$executeRaw`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Update Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  throw new Error('Failed to Delete Invoice');
  try {
    await db.$executeRaw`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return {
      message: 'Database Error: Failed to Delete Invoice.',
    };
  }
}

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
