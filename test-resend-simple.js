import { Resend } from 'resend';

const resend = new Resend('re_18TmyYFv_7VDHb7RXGKTsd8WeirGFF4D7');

async function test() {
  try {
    console.log('Testing Resend API...');
    
    // Try to send to Resend's test email
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: ['delivered@resend.dev'], // Resend's test email address
      subject: 'Hello World',
      html: '<strong>It works!</strong>',
    });

    if (error) {
      console.error('Error:', error);
      return false;
    }

    console.log('Success! Email ID:', data?.id);
    return true;
  } catch (err) {
    console.error('Catch error:', err);
    return false;
  }
}

test();
